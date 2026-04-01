import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse as parseCSV } from 'https://deno.land/std@0.208.0/csv/mod.ts'

// ─── Configuración ────────────────────────────────────────────────────────────

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ErpFileType {
  key: string
  label: string
  encoding: string
  separator: string
  column_mapping: Record<string, string>
  required_columns: string[]
  analysis_capabilities: string[]
}

interface ClientData {
  config: {
    decimal_separator?: string
    category_mapping?: Record<string, string>
    comercial_display_names?: Record<string, string>
  }
  erp_profile_id?: string | null
}

// Fila genérica del CSV — todos los campos en bruto
type RawRow = Record<string, string>

// Fila normalizada para análisis de líneas de venta (con margen/coste)
interface SalesRow {
  fecha: string
  cliente_codigo: string
  cliente_nombre: string
  categoria: string
  comercial: string
  cantidad: number
  margen: number
  importe_total: number
  producto_codigo: string
  producto_nombre: string
}

// Fila normalizada para análisis de facturas (cabeceras, sin líneas)
interface InvoiceRow {
  referencia: string
  fecha: string
  cliente_codigo: string
  cliente_nombre: string
  comercial: string
  importe: number
  base_imponible: number
  estado_cobro: string
  importe_cobrado: number
  importe_pendiente: number
}

interface TriggerPayload {
  record?: { id: string; cycle_id: string; client_id: string; file_path: string; file_name: string }
  file_id?: string; cycle_id?: string; client_id?: string; file_path?: string; file_name?: string
}

// ─── Servidor ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ') || auth.replace('Bearer ', '') !== SUPABASE_SERVICE_KEY) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let payload: TriggerPayload
  try { payload = await req.json() }
  catch { return json({ error: 'Invalid JSON body' }, 400) }

  const rec      = payload.record
  const fileId   = rec?.id        ?? payload.file_id    ?? ''
  const cycleId  = rec?.cycle_id  ?? payload.cycle_id   ?? ''
  const clientId = rec?.client_id ?? payload.client_id  ?? ''
  const filePath = rec?.file_path ?? payload.file_path  ?? ''
  const fileName = rec?.file_name ?? payload.file_name  ?? ''

  if (!cycleId || !clientId || !filePath) {
    return json({ error: 'Missing required fields' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // ── 1. Marcar ciclo como procesando ────────────────────────────────────
    await supabase.from('analysis_cycles').update({ status: 'procesando' }).eq('id', cycleId)

    // ── 2. Obtener cliente + perfil ERP ────────────────────────────────────
    const { data: clientData, error: clientErr } = await supabase
      .from('clients')
      .select('config, erp_profile_id')
      .eq('id', clientId)
      .single()
    if (clientErr) throw new Error(`Error obteniendo cliente: ${clientErr.message}`)

    const client = clientData as ClientData

    // Cargar perfil ERP si está configurado
    let erpFileTypes: ErpFileType[] = []
    if (client.erp_profile_id) {
      const { data: profileData } = await supabase
        .from('erp_profiles')
        .select('file_types')
        .eq('id', client.erp_profile_id)
        .single()
      erpFileTypes = (profileData?.file_types ?? []) as ErpFileType[]
    }

    // ── 3. Descargar y decodificar CSV ─────────────────────────────────────
    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from('csv-uploads').download(filePath)
    if (downloadErr || !fileBlob) throw new Error(`Error descargando archivo: ${downloadErr?.message}`)

    const buffer = await fileBlob.arrayBuffer()

    // Detectar encoding: si hay perfil se usa el del file_type más probable,
    // si no, se prueba UTF-8 y si tiene signos raros se usa windows-1252
    const rawUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    const firstLine = rawUtf8.split('\n')[0] ?? ''

    // ── 4. Identificar el tipo de fichero ERP ─────────────────────────────
    const matchedFileType = erpFileTypes.length > 0
      ? matchFileType(firstLine, erpFileTypes)
      : null

    // Determinar encoding y separador definitivos
    const encoding  = matchedFileType?.encoding ?? 'utf-8'
    const separator = matchedFileType?.separator
      ?? (firstLine.includes(';') ? ';' : ',')

    // Decodificar con el encoding correcto
    const csvText = new TextDecoder(encoding as string, { fatal: false }).decode(buffer)

    // ── 5. Parsear CSV ─────────────────────────────────────────────────────
    let rawRows: RawRow[] = []
    try {
      rawRows = parseCSV(csvText, {
        skipFirstRow: true,
        separator: separator as string,
        trimLeadingSpace: true,
      }) as RawRow[]
    } catch (e) {
      throw new Error(`Error parseando CSV: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (rawRows.length === 0) {
      await markError(supabase, cycleId, fileId, 'CSV vacío o sin filas de datos')
      return json({ error: 'Empty CSV' }, 422)
    }

    const csvHeaders = Object.keys(rawRows[0] ?? {})
    const colMapping = matchedFileType?.column_mapping ?? {}
    const capabilities = matchedFileType?.analysis_capabilities ?? []
    const decimalSep = client.config?.decimal_separator ?? ','
    const catMap = client.config?.category_mapping ?? {}

    console.log(`[process-csv] Fichero: ${fileName}, ${rawRows.length} filas, tipo: ${matchedFileType?.key ?? 'auto'}`)
    console.log(`[process-csv] Capacidades: ${capabilities.join(', ') || 'auto-detect'}`)

    // ── 6. Elegir pipeline de análisis ─────────────────────────────────────
    const hasMarginData = capabilities.includes('margen_categoria')
      || capabilities.includes('oportunidades_mix')
      || capabilities.length === 0 // sin perfil: intentar pipeline de líneas

    const hasInvoiceData = capabilities.includes('riesgo_cobro')
      || capabilities.includes('facturacion_cliente')

    let kpis: Record<string, unknown>
    let extendedData: Record<string, unknown>
    let validationResult: Record<string, unknown>
    let rowsProcessed: number

    if (hasMarginData) {
      // ── Pipeline A: líneas de venta con margen ─────────────────────────
      const { rows, validation } = parseSalesRows(rawRows, csvHeaders, colMapping, decimalSep, catMap)
      validationResult = validation
      rowsProcessed = rows.length

      if (rows.length === 0) {
        await markError(supabase, cycleId, fileId, validation.errors?.[0] as string ?? 'Sin filas válidas')
        return json({ error: 'No valid rows' }, 422)
      }

      const result = calculateSalesKPIs(rows)
      kpis = result.kpis
      extendedData = result.extendedData

    } else if (hasInvoiceData) {
      // ── Pipeline B: cabeceras de factura ───────────────────────────────
      const { rows, validation } = parseInvoiceRows(rawRows, csvHeaders, colMapping, decimalSep)
      validationResult = validation
      rowsProcessed = rows.length

      if (rows.length === 0) {
        await markError(supabase, cycleId, fileId, validation.errors?.[0] as string ?? 'Sin filas válidas')
        return json({ error: 'No valid rows' }, 422)
      }

      const result = calculateInvoiceKPIs(rows, capabilities)
      kpis = result.kpis
      extendedData = result.extendedData

    } else {
      // ── Pipeline C: intento auto-detect por columnas disponibles ────────
      const canDetectMargin = csvHeaders.some(h =>
        h.toLowerCase().includes('margen') || h.toLowerCase().includes('coste')
      )
      if (canDetectMargin) {
        const { rows, validation } = parseSalesRows(rawRows, csvHeaders, {}, decimalSep, catMap)
        validationResult = validation
        rowsProcessed = rows.length
        const result = calculateSalesKPIs(rows)
        kpis = result.kpis
        extendedData = result.extendedData
      } else {
        const { rows, validation } = parseInvoiceRows(rawRows, csvHeaders, {}, decimalSep)
        validationResult = validation
        rowsProcessed = rows.length
        const result = calculateInvoiceKPIs(rows, [])
        kpis = result.kpis
        extendedData = result.extendedData
      }
    }

    // ── 7. Escribir KPIs ───────────────────────────────────────────────────
    const { data: existingKpi } = await supabase
      .from('kpis').select('id').eq('cycle_id', cycleId).single()

    const kpiPayload = {
      cycle_id:                  cycleId,
      client_id:                 clientId,
      facturacion_total:         kpis.facturacion_total as number,
      margen_porcentaje:         (kpis.margen_porcentaje as number) ?? 0,
      potencial_mensual:         (kpis.potencial_mensual as number) ?? 0,
      potencial_anual:           (kpis.potencial_anual as number) ?? 0,
      total_oportunidades:       (kpis.total_oportunidades as number) ?? 0,
      clientes_activos:          kpis.clientes_activos as number,
      top_categoria:             (kpis.top_categoria as string) ?? null,
      categoria_mayor_potencial: (kpis.categoria_mayor_potencial as string) ?? null,
      oportunidades_por_tipo:    kpis.oportunidades_por_tipo ?? {},
      extended_data:             extendedData,
      source:                    'automatico',
    }

    if (existingKpi?.id) {
      await supabase.from('kpis').update(kpiPayload).eq('id', existingKpi.id)
    } else {
      await supabase.from('kpis').insert(kpiPayload)
    }

    // ── 8. Actualizar validation_result del archivo ────────────────────────
    if (fileId) {
      await supabase.from('uploaded_files')
        .update({ validation_result: validationResult })
        .eq('id', fileId)
    }

    // ── 9. Ciclo → completado ──────────────────────────────────────────────
    await supabase.from('analysis_cycles').update({ status: 'completado' }).eq('id', cycleId)

    // ── 10. Log ────────────────────────────────────────────────────────────
    await supabase.from('system_logs').insert({
      action: 'csv_procesado',
      client_id: clientId,
      details: {
        cycle_id: cycleId,
        file_name: fileName,
        file_type_key: matchedFileType?.key ?? 'auto',
        filas_procesadas: rowsProcessed,
        clientes_detectados: kpis.clientes_activos,
        potencial_mensual: kpis.potencial_mensual ?? 0,
      },
    })

    return json({
      success: true,
      file_type: matchedFileType?.key ?? 'auto',
      rows_processed: rowsProcessed,
      clientes: kpis.clientes_activos,
      potencial_mensual: kpis.potencial_mensual ?? 0,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[process-csv] Error:', msg)
    await markError(supabase, cycleId, fileId, msg).catch(() => {})
    return json({ error: msg }, 500)
  }
})

// ─── Detección de tipo de fichero ─────────────────────────────────────────────

function matchFileType(firstLine: string, fileTypes: ErpFileType[]): ErpFileType | null {
  if (fileTypes.length === 0) return null

  // Detectar separador del CSV
  const csvSep = firstLine.includes(';') ? ';' : ','
  const csvHeaders = firstLine.split(csvSep).map(h => h.trim().replace(/^["']|["']$/g, ''))

  let bestMatch: ErpFileType | null = null
  let bestScore = 0

  for (const ft of fileTypes) {
    const required = ft.required_columns ?? []
    if (required.length === 0) continue
    const hits = required.filter(col => csvHeaders.includes(col)).length
    const score = hits / required.length
    if (score > bestScore) {
      bestScore = score
      bestMatch = ft
    }
  }

  // Aceptar si al menos el 50% de las columnas requeridas coinciden
  return bestScore >= 0.5 ? bestMatch : (fileTypes.length === 1 ? fileTypes[0] : null)
}

// ─── Pipeline A: líneas de venta ──────────────────────────────────────────────

function parseSalesRows(
  rawRows: RawRow[],
  csvHeaders: string[],
  colMapping: Record<string, string>,
  decimalSep: string,
  catMap: Record<string, string>,
): { rows: SalesRow[]; validation: Record<string, unknown> } {

  const getCol = (field: string) => colMapping[field] ?? field

  // Intentar auto-mapeo si no hay mapeo explícito: buscar columnas por similitud
  const autoMap = buildAutoMap(csvHeaders, colMapping)

  const parseNum = makeNumParser(decimalSep)
  const rows: SalesRow[] = []
  const errors: string[] = []
  const warnings: string[] = []
  let skipped = 0

  for (const raw of rawRows) {
    const clienteCodigo = (raw[autoMap('cliente_codigo')] ?? raw[autoMap('cliente')] ?? '').trim()
    const importeStr = raw[autoMap('importe')] ?? raw[autoMap('importe_total')] ?? ''
    const importe = parseNum(importeStr)

    if (!clienteCodigo || importe <= 0) { skipped++; continue }

    let categoria = (raw[autoMap('categoria')] ?? '').trim()
    if (catMap[categoria]) categoria = catMap[categoria]

    rows.push({
      fecha:           (raw[autoMap('fecha')] ?? '').trim(),
      cliente_codigo:  clienteCodigo,
      cliente_nombre:  (raw[autoMap('cliente')] ?? clienteCodigo).trim(),
      categoria:       categoria || 'Sin categoría',
      comercial:       (raw[autoMap('comercial')] ?? '').trim(),
      cantidad:        parseNum(raw[autoMap('cantidad')] ?? ''),
      margen:          parseNum(raw[autoMap('margen')] ?? ''),
      importe_total:   importe,
      producto_codigo: (raw[autoMap('producto_codigo')] ?? '').trim(),
      producto_nombre: (raw[autoMap('producto')] ?? '').trim(),
    })
  }

  if (skipped > rawRows.length * 0.3) {
    warnings.push(`Se omitieron ${skipped} filas por datos incompletos`)
  }
  if (rows.length === 0) {
    errors.push('No se encontraron filas válidas. Verifica el mapeo de columnas.')
  }

  return {
    rows,
    validation: {
      is_valid: errors.length === 0,
      errors,
      warnings,
      row_count: rows.length,
      skipped_rows: skipped,
      columns_detected: csvHeaders,
      pipeline: 'lineas_venta',
    },
  }
}

function buildAutoMap(
  csvHeaders: string[],
  explicitMap: Record<string, string>,
): (field: string) => string {
  // Diccionario de sinónimos para auto-detección
  const synonyms: Record<string, string[]> = {
    cliente_codigo:  ['Cliente', 'Codigo cliente', 'CodCliente', 'cliente_codigo'],
    cliente:         ['Nombre del cliente', 'Nombre Cliente', 'NombreCliente', 'cliente'],
    comercial:       ['Agente', 'Comercial', 'Vendedor', 'comercial'],
    fecha:           ['Fecha', 'fecha'],
    importe:         ['Total importe', 'Importe Neto', 'importe_total', 'Total', 'Importe'],
    categoria:       ['Familia', 'Familia del cliente', 'categoria', 'Categoría'],
    margen:          ['Margen', 'margen', 'Margen calculado'],
    cantidad:        ['Cantidad', 'cantidad'],
    producto_codigo: ['Referencia', 'Ref', 'producto_codigo'],
    producto:        ['Descripción', 'Articulo', 'producto'],
  }

  return (field: string): string => {
    // 1. Usar mapeo explícito si existe
    if (explicitMap[field]) return explicitMap[field]
    // 2. Buscar por sinónimos en los headers reales del CSV
    const candidates = synonyms[field] ?? []
    for (const c of candidates) {
      if (csvHeaders.includes(c)) return c
    }
    // 3. Fallback al nombre interno
    return field
  }
}

// ─── Pipeline B: cabeceras de factura ─────────────────────────────────────────

function parseInvoiceRows(
  rawRows: RawRow[],
  csvHeaders: string[],
  colMapping: Record<string, string>,
  decimalSep: string,
): { rows: InvoiceRow[]; validation: Record<string, unknown> } {

  const autoMap = buildAutoMap(csvHeaders, colMapping)
  const parseNum = makeNumParser(decimalSep)
  const rows: InvoiceRow[] = []
  const errors: string[] = []
  const warnings: string[] = []
  let skipped = 0

  // Mapeo explícito para campos de factura
  const getCliente = () => autoMap('cliente') || autoMap('cliente_codigo')
  const getImporte = () => colMapping['importe'] ?? 'Total importe'
  const getEstado  = () => colMapping['estado_cobro'] ?? 'Estado'
  const getCobrado = () => colMapping['importe_cobrado'] ?? 'Importe cobrado'
  const getPendiente = () => colMapping['importe_pendiente'] ?? 'Importe restante'
  const getComercial = () => colMapping['comercial'] ?? autoMap('comercial')
  const getFecha    = () => colMapping['fecha'] ?? autoMap('fecha')
  const getReferencia = () => colMapping['referencia'] ?? autoMap('producto_codigo')

  for (const raw of rawRows) {
    const clienteNombre = (raw[getCliente()] ?? '').trim()
    const importeStr = raw[getImporte()] ?? ''
    const importe = parseNum(importeStr)

    if (!clienteNombre || importe <= 0) { skipped++; continue }

    rows.push({
      referencia:       (raw[getReferencia()] ?? '').trim(),
      fecha:            (raw[getFecha()] ?? '').trim(),
      cliente_codigo:   (raw[colMapping['cliente_codigo'] ?? 'Cliente'] ?? clienteNombre).trim(),
      cliente_nombre:   clienteNombre,
      comercial:        (raw[getComercial()] ?? '').trim(),
      importe,
      base_imponible:   parseNum(raw[colMapping['base_imponible'] ?? 'Total base'] ?? ''),
      estado_cobro:     (raw[getEstado()] ?? '').trim(),
      importe_cobrado:  parseNum(raw[getCobrado()] ?? ''),
      importe_pendiente:parseNum(raw[getPendiente()] ?? ''),
    })
  }

  if (skipped > rawRows.length * 0.3) {
    warnings.push(`Se omitieron ${skipped} filas por datos incompletos`)
  }
  if (rows.length === 0) {
    errors.push('No se encontraron facturas válidas. Verifica las columnas de importe y cliente.')
  }

  return {
    rows,
    validation: {
      is_valid: errors.length === 0,
      errors,
      warnings,
      row_count: rows.length,
      skipped_rows: skipped,
      columns_detected: csvHeaders,
      pipeline: 'facturas',
    },
  }
}

// ─── Motor KPIs: líneas de venta ──────────────────────────────────────────────

function calculateSalesKPIs(rows: SalesRow[]) {
  const clienteMap = new Map<string, {
    nombre: string; comercial: string
    importe: number; margenPond: number; importePond: number
    categorias: Set<string>; productos: Set<string>
  }>()
  const catMap = new Map<string, { importe: number; margenPond: number; importePond: number }>()
  const comMap = new Map<string, { clientes: Set<string>; importe: number; margenPond: number; importePond: number }>()
  const prodMap = new Map<string, { clientes: Set<string>; importe: number; nombre: string }>()

  for (const row of rows) {
    if (!clienteMap.has(row.cliente_codigo)) {
      clienteMap.set(row.cliente_codigo, {
        nombre: row.cliente_nombre, comercial: row.comercial,
        importe: 0, margenPond: 0, importePond: 0,
        categorias: new Set(), productos: new Set(),
      })
    }
    const cli = clienteMap.get(row.cliente_codigo)!
    cli.importe += row.importe_total
    cli.margenPond += row.margen * row.importe_total
    cli.importePond += row.importe_total
    if (row.categoria) cli.categorias.add(row.categoria)
    if (row.producto_codigo) cli.productos.add(row.producto_codigo)

    if (!catMap.has(row.categoria)) catMap.set(row.categoria, { importe: 0, margenPond: 0, importePond: 0 })
    const cat = catMap.get(row.categoria)!
    cat.importe += row.importe_total; cat.margenPond += row.margen * row.importe_total; cat.importePond += row.importe_total

    if (row.comercial) {
      if (!comMap.has(row.comercial)) comMap.set(row.comercial, { clientes: new Set(), importe: 0, margenPond: 0, importePond: 0 })
      const com = comMap.get(row.comercial)!
      com.clientes.add(row.cliente_codigo); com.importe += row.importe_total
      com.margenPond += row.margen * row.importe_total; com.importePond += row.importe_total
    }

    if (row.producto_codigo) {
      if (!prodMap.has(row.producto_codigo)) prodMap.set(row.producto_codigo, { clientes: new Set(), importe: 0, nombre: row.producto_nombre })
      const prod = prodMap.get(row.producto_codigo)!
      prod.clientes.add(row.cliente_codigo); prod.importe += row.importe_total
    }
  }

  const totalImporte = rows.reduce((s, r) => s + r.importe_total, 0)
  const globalMargenPct = totalImporte > 0
    ? rows.reduce((s, r) => s + r.margen * r.importe_total, 0) / totalImporte : 0
  const totalClientes = clienteMap.size

  const margenPorCategoria = Array.from(catMap.entries())
    .map(([cat, d]) => ({
      categoria: cat,
      margen_pct: d.importePond > 0 ? Math.round(d.margenPond / d.importePond * 10) / 10 : 0,
      facturacion: Math.round(d.importe),
    }))
    .sort((a, b) => b.facturacion - a.facturacion)

  const topCategoria = margenPorCategoria[0]?.categoria ?? null
  const catConPotencial = margenPorCategoria.filter(c => c.margen_pct < globalMargenPct * 0.9).sort((a, b) => b.facturacion - a.facturacion)
  const categoriaMayorPotencial = catConPotencial[0]?.categoria ?? topCategoria

  const comerciales = Array.from(comMap.entries())
    .map(([nombre, d]) => {
      const margenCom = d.importePond > 0 ? d.margenPond / d.importePond : 0
      const potencial = d.importe * Math.max(0, globalMargenPct - margenCom) / 100
      return { nombre_erp: nombre, n_clientes: d.clientes.size, facturacion: Math.round(d.importe), margen_pct: Math.round(margenCom * 10) / 10, potencial_mes: Math.round(potencial / 12) }
    })
    .sort((a, b) => b.potencial_mes - a.potencial_mes)

  const oportunidades: Array<{ cliente_codigo: string; cliente_nombre: string; tipo: string; potencial_mes: number }> = []
  const catSignificativas = margenPorCategoria.filter(c => c.facturacion / totalImporte > 0.06).map(c => c.categoria)
  const prodComunes = Array.from(prodMap.entries()).filter(([, d]) => d.clientes.size / totalClientes > 0.25).map(([code]) => code)
  const importeMediano = mediana(Array.from(clienteMap.values()).map(c => c.importe))

  for (const [codigo, cli] of clienteMap.entries()) {
    const clienteMargenPct = cli.importePond > 0 ? cli.margenPond / cli.importePond : 0
    if (clienteMargenPct < globalMargenPct * 0.85 && cli.importe > importeMediano * 0.3) {
      const potencial = cli.importe * (globalMargenPct - clienteMargenPct) / 100 / 12
      if (potencial > 50) oportunidades.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, tipo: 'mix_suboptimo', potencial_mes: Math.round(potencial) })
    }
    for (const cat of catSignificativas) {
      if (!cli.categorias.has(cat)) {
        const catData = catMap.get(cat)!
        const avgPurchase = catData.importe / clienteMap.size
        const potencial = avgPurchase * (catData.importePond > 0 ? catData.margenPond / catData.importePond : globalMargenPct) / 100 / 12
        if (potencial > 30) { oportunidades.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, tipo: 'categoria_perdida', potencial_mes: Math.round(potencial) }); break }
      }
    }
    const prodFaltante = prodComunes.find(p => !cli.productos.has(p))
    if (prodFaltante) {
      const pd = prodMap.get(prodFaltante)!
      const potencial = (pd.importe / pd.clientes.size) * globalMargenPct / 100 / 12
      if (potencial > 20) oportunidades.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, tipo: 'producto_no_ofrecido', potencial_mes: Math.round(potencial) })
    }
  }

  const riesgo: Array<{ cliente_codigo: string; cliente_nombre: string; severidad: string; caida_pct: number; impacto_mes: number }> = []
  for (const [codigo, cli] of clienteMap.entries()) {
    const m = cli.importePond > 0 ? cli.margenPond / cli.importePond : 0
    const impacto = Math.round(cli.importe / 12)
    const caida = Math.round((m - globalMargenPct) * 10) / 10
    if (m < globalMargenPct * 0.5 && cli.importe > importeMediano) riesgo.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, severidad: 'CRITICO', caida_pct: caida, impacto_mes: impacto })
    else if (m < globalMargenPct * 0.7 && cli.importe > importeMediano * 0.5) riesgo.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, severidad: 'ATENCION', caida_pct: caida, impacto_mes: impacto })
    else if (m < globalMargenPct * 0.85 && cli.importe > importeMediano * 2) riesgo.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, severidad: 'SEGUIMIENTO', caida_pct: caida, impacto_mes: impacto })
  }
  riesgo.sort((a, b) => { const o: Record<string, number> = { CRITICO: 0, ATENCION: 1, SEGUIMIENTO: 2 }; return (o[a.severidad] ?? 9) - (o[b.severidad] ?? 9) || b.impacto_mes - a.impacto_mes })

  for (const com of comerciales) {
    const clientesDelCom = new Set(Array.from(clienteMap.entries()).filter(([, c]) => c.comercial === com.nombre_erp).map(([code]) => code))
    com.potencial_mes = Math.round(oportunidades.filter(o => clientesDelCom.has(o.cliente_codigo)).reduce((s, o) => s + o.potencial_mes, 0))
  }

  const potencialMensual = Math.round(oportunidades.reduce((s, o) => s + o.potencial_mes, 0))

  return {
    kpis: {
      facturacion_total: Math.round(totalImporte),
      margen_porcentaje: Math.round(globalMargenPct * 10) / 10,
      potencial_mensual: potencialMensual,
      potencial_anual: potencialMensual * 12,
      total_oportunidades: oportunidades.length,
      clientes_activos: totalClientes,
      top_categoria: topCategoria,
      categoria_mayor_potencial: categoriaMayorPotencial,
      oportunidades_por_tipo: {
        categoria_perdida: oportunidades.filter(o => o.tipo === 'categoria_perdida').length,
        mix_suboptimo: oportunidades.filter(o => o.tipo === 'mix_suboptimo').length,
        cliente_caida: 0,
        producto_no_ofrecido: oportunidades.filter(o => o.tipo === 'producto_no_ofrecido').length,
      },
    },
    extendedData: {
      pipeline: 'lineas_venta',
      margen_por_categoria: margenPorCategoria,
      oportunidades_detalle: oportunidades.sort((a, b) => b.potencial_mes - a.potencial_mes).slice(0, 50),
      comerciales,
      riesgo: riesgo.slice(0, 30),
    },
  }
}

// ─── Motor KPIs: facturas (cabeceras) ─────────────────────────────────────────

function calculateInvoiceKPIs(rows: InvoiceRow[], capabilities: string[]) {
  const clienteMap = new Map<string, {
    nombre: string; comercial: string
    facturacion: number; cobrado: number; pendiente: number
    n_facturas: number; estados: Set<string>
  }>()
  const comercialMap = new Map<string, { facturacion: number; n_facturas: number; n_clientes: Set<string>; pendiente: number }>()
  const mesesMap = new Map<string, number>()

  for (const row of rows) {
    const clave = row.cliente_codigo || row.cliente_nombre

    if (!clienteMap.has(clave)) {
      clienteMap.set(clave, {
        nombre: row.cliente_nombre, comercial: row.comercial,
        facturacion: 0, cobrado: 0, pendiente: 0, n_facturas: 0, estados: new Set(),
      })
    }
    const cli = clienteMap.get(clave)!
    cli.facturacion += row.importe
    cli.cobrado += row.importe_cobrado
    cli.pendiente += row.importe_pendiente
    cli.n_facturas++
    if (row.estado_cobro) cli.estados.add(row.estado_cobro)

    if (row.comercial) {
      if (!comercialMap.has(row.comercial)) comercialMap.set(row.comercial, { facturacion: 0, n_facturas: 0, n_clientes: new Set(), pendiente: 0 })
      const com = comercialMap.get(row.comercial)!
      com.facturacion += row.importe; com.n_facturas++; com.n_clientes.add(clave); com.pendiente += row.importe_pendiente
    }

    if (row.fecha) {
      const mes = row.fecha.substring(0, 7).replace(/\//g, '-') // YYYY-MM o MM/YYYY
      mesesMap.set(mes, (mesesMap.get(mes) ?? 0) + row.importe)
    }
  }

  const totalFacturacion = rows.reduce((s, r) => s + r.importe, 0)
  const totalPendiente = rows.reduce((s, r) => s + r.importe_pendiente, 0)
  const totalClientes = clienteMap.size
  const tasaImpago = totalFacturacion > 0 ? totalPendiente / totalFacturacion : 0

  // Top clientes por facturación
  const topClientes = Array.from(clienteMap.entries())
    .map(([codigo, d]) => ({
      cliente_codigo: codigo,
      cliente_nombre: d.nombre,
      comercial: d.comercial,
      facturacion: Math.round(d.facturacion),
      pendiente: Math.round(d.pendiente),
      n_facturas: d.n_facturas,
      tasa_cobro: d.facturacion > 0 ? Math.round((d.cobrado / d.facturacion) * 100) : 100,
    }))
    .sort((a, b) => b.facturacion - a.facturacion)
    .slice(0, 30)

  // Comerciales
  const comerciales = Array.from(comercialMap.entries())
    .map(([nombre, d]) => ({
      nombre_erp: nombre,
      n_clientes: d.n_clientes.size,
      facturacion: Math.round(d.facturacion),
      pendiente: Math.round(d.pendiente),
      n_facturas: d.n_facturas,
      tasa_cobro: d.facturacion > 0 ? Math.round((1 - d.pendiente / d.facturacion) * 100) : 100,
      potencial_mes: 0, // no computable sin márgenes
    }))
    .sort((a, b) => b.facturacion - a.facturacion)

  // Riesgo de cobro: clientes con alta tasa de impago
  const riesgo: Array<{ cliente_codigo: string; cliente_nombre: string; severidad: string; caida_pct: number; impacto_mes: number }> = []
  for (const [codigo, d] of clienteMap.entries()) {
    const tasaCliente = d.facturacion > 0 ? d.pendiente / d.facturacion : 0
    const impactoMes = Math.round(d.facturacion / Math.max(1, mesesMap.size))
    if (tasaCliente > 0.5) riesgo.push({ cliente_codigo: codigo, cliente_nombre: d.nombre, severidad: 'CRITICO', caida_pct: Math.round(tasaCliente * 100), impacto_mes: impactoMes })
    else if (tasaCliente > 0.25) riesgo.push({ cliente_codigo: codigo, cliente_nombre: d.nombre, severidad: 'ATENCION', caida_pct: Math.round(tasaCliente * 100), impacto_mes: impactoMes })
    else if (tasaCliente > 0.1 && d.facturacion > totalFacturacion / totalClientes * 2) riesgo.push({ cliente_codigo: codigo, cliente_nombre: d.nombre, severidad: 'SEGUIMIENTO', caida_pct: Math.round(tasaCliente * 100), impacto_mes: impactoMes })
  }
  riesgo.sort((a, b) => { const o: Record<string, number> = { CRITICO: 0, ATENCION: 1, SEGUIMIENTO: 2 }; return (o[a.severidad] ?? 9) - (o[b.severidad] ?? 9) || b.impacto_mes - a.impacto_mes })

  // Tendencia mensual
  const tendencia = Array.from(mesesMap.entries())
    .map(([mes, facturacion]) => ({ mes, facturacion: Math.round(facturacion) }))
    .sort((a, b) => a.mes.localeCompare(b.mes))

  return {
    kpis: {
      facturacion_total: Math.round(totalFacturacion),
      margen_porcentaje: 0, // no disponible con sólo facturas
      potencial_mensual: 0,
      potencial_anual: 0,
      total_oportunidades: 0,
      clientes_activos: totalClientes,
      top_categoria: null,
      categoria_mayor_potencial: null,
      oportunidades_por_tipo: { categoria_perdida: 0, mix_suboptimo: 0, cliente_caida: 0, producto_no_ofrecido: 0 },
      // KPIs extra de cobro
      total_pendiente: Math.round(totalPendiente),
      tasa_impago_pct: Math.round(tasaImpago * 100),
    },
    extendedData: {
      pipeline: 'facturas',
      capabilities,
      resumen_cobro: {
        total_facturado: Math.round(totalFacturacion),
        total_cobrado: Math.round(totalFacturacion - totalPendiente),
        total_pendiente: Math.round(totalPendiente),
        tasa_cobro_pct: Math.round((1 - tasaImpago) * 100),
        n_facturas: rows.length,
      },
      top_clientes: topClientes,
      comerciales,
      riesgo: riesgo.slice(0, 30),
      tendencia_mensual: tendencia,
      margen_por_categoria: [], // no disponible
      oportunidades_detalle: [],
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNumParser(decimalSep: string) {
  return (s: string): number => {
    if (!s || s.trim() === '') return 0
    let clean = s.trim().replace(/\s/g, '')
    if (decimalSep === ',') {
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else {
      clean = clean.replace(/,/g, '')
    }
    const n = parseFloat(clean)
    return isNaN(n) ? 0 : n
  }
}

function mediana(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

async function markError(
  supabase: ReturnType<typeof createClient>,
  cycleId: string,
  fileId: string,
  errorMsg: string,
) {
  await Promise.all([
    supabase.from('analysis_cycles').update({ status: 'csv_recibido' }).eq('id', cycleId),
    fileId ? supabase.from('uploaded_files').update({
      validation_result: { is_valid: false, errors: [errorMsg], warnings: [], row_count: 0 },
    }).eq('id', fileId) : Promise.resolve(),
  ])
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
