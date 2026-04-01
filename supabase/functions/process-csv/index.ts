import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse as parseCSV } from 'https://deno.land/std@0.208.0/csv/mod.ts'

// ─── Configuración ────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ─── Tipos internos ────────────────────────────────────────────────────────────

interface ParsedRow {
  fecha: string
  cliente_codigo: string
  cliente_nombre: string
  categoria: string
  comercial: string
  cantidad: number
  margen: number       // porcentaje, e.g. 25.5
  importe_total: number
  producto_codigo: string
  producto_nombre: string
}

interface ClientConfig {
  encoding?: string
  decimal_separator?: string
  column_mapping?: Record<string, string>
  category_mapping?: Record<string, string>
  comercial_display_names?: Record<string, string>
}

interface TriggerPayload {
  record?: {
    id: string
    cycle_id: string
    client_id: string
    file_path: string
    file_name: string
  }
  // llamada directa (desde API route)
  file_id?: string
  cycle_id?: string
  client_id?: string
  file_path?: string
  file_name?: string
}

// ─── Servidor ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Verificar autorización
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ') || auth.replace('Bearer ', '') !== SUPABASE_SERVICE_KEY) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let payload: TriggerPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  // Normalizar campos (webhook DB o llamada directa)
  const rec = payload.record
  const fileId    = rec?.id        ?? payload.file_id    ?? ''
  const cycleId   = rec?.cycle_id  ?? payload.cycle_id   ?? ''
  const clientId  = rec?.client_id ?? payload.client_id  ?? ''
  const filePath  = rec?.file_path ?? payload.file_path  ?? ''
  const fileName  = rec?.file_name ?? payload.file_name  ?? ''

  if (!cycleId || !clientId || !filePath) {
    return json({ error: 'Missing required fields' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // ── 1. Marcar ciclo como procesando ────────────────────────────────────
    await supabase
      .from('analysis_cycles')
      .update({ status: 'procesando' })
      .eq('id', cycleId)

    // ── 2. Obtener configuración del cliente ───────────────────────────────
    const { data: clientData, error: clientErr } = await supabase
      .from('clients')
      .select('config')
      .eq('id', clientId)
      .single()

    if (clientErr) throw new Error(`Error obteniendo cliente: ${clientErr.message}`)
    const config = (clientData?.config ?? {}) as ClientConfig

    // ── 3. Descargar CSV desde storage ─────────────────────────────────────
    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from('csv-uploads')
      .download(filePath)

    if (downloadErr || !fileBlob) throw new Error(`Error descargando archivo: ${downloadErr?.message}`)

    const buffer = await fileBlob.arrayBuffer()
    const encoding = config.encoding ?? 'utf-8'
    const decoder = new TextDecoder(encoding)
    const csvText = decoder.decode(buffer)

    // ── 4. Parsear CSV ─────────────────────────────────────────────────────
    const { rows, validationResult } = parseCSVData(csvText, config, fileName)

    if (rows.length === 0) {
      await markError(supabase, cycleId, fileId, 'No se encontraron filas válidas en el CSV')
      return json({ error: 'Empty CSV' }, 422)
    }

    // ── 5. Calcular KPIs y oportunidades ──────────────────────────────────
    const { kpis, extendedData } = calculateKPIs(rows)

    // ── 6. Escribir KPIs en la base de datos ──────────────────────────────
    const { data: existingKpi } = await supabase
      .from('kpis')
      .select('id')
      .eq('cycle_id', cycleId)
      .single()

    const kpiPayload = {
      cycle_id: cycleId,
      client_id: clientId,
      facturacion_total: kpis.facturacion_total,
      margen_porcentaje: kpis.margen_porcentaje,
      potencial_mensual: kpis.potencial_mensual,
      potencial_anual: kpis.potencial_anual,
      total_oportunidades: kpis.total_oportunidades,
      clientes_activos: kpis.clientes_activos,
      top_categoria: kpis.top_categoria,
      categoria_mayor_potencial: kpis.categoria_mayor_potencial,
      oportunidades_por_tipo: kpis.oportunidades_por_tipo,
      extended_data: extendedData,
      source: 'automatico',
    }

    if (existingKpi?.id) {
      await supabase.from('kpis').update(kpiPayload).eq('id', existingKpi.id)
    } else {
      await supabase.from('kpis').insert(kpiPayload)
    }

    // ── 7. Actualizar validation_result del archivo ────────────────────────
    if (fileId) {
      await supabase
        .from('uploaded_files')
        .update({ validation_result: validationResult })
        .eq('id', fileId)
    }

    // ── 8. Marcar ciclo como completado ────────────────────────────────────
    await supabase
      .from('analysis_cycles')
      .update({ status: 'completado' })
      .eq('id', cycleId)

    // ── 9. Log del sistema ─────────────────────────────────────────────────
    await supabase.from('system_logs').insert({
      action: 'csv_procesado',
      client_id: clientId,
      details: {
        cycle_id: cycleId,
        file_name: fileName,
        filas_procesadas: rows.length,
        clientes_detectados: kpis.clientes_activos,
        potencial_mensual: kpis.potencial_mensual,
      },
    })

    return json({
      success: true,
      rows_processed: rows.length,
      clientes: kpis.clientes_activos,
      potencial_mensual: kpis.potencial_mensual,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[process-csv] Error:', msg)
    await markError(supabase, cycleId, fileId, msg).catch(() => {})
    return json({ error: msg }, 500)
  }
})

// ─── Parser CSV ───────────────────────────────────────────────────────────────

function parseCSVData(
  csvText: string,
  config: ClientConfig,
  fileName: string,
): { rows: ParsedRow[]; validationResult: Record<string, unknown> } {
  const decimalSep = config.decimal_separator ?? ','
  const colMap = config.column_mapping ?? {}
  const catMap = config.category_mapping ?? {}

  // Auto-detectar separador de columnas
  const firstLine = csvText.split('\n')[0] ?? ''
  const sep = firstLine.includes(';') ? ';' : ','

  // Parsear con deno csv
  let rawRows: Record<string, string>[] = []
  try {
    rawRows = parseCSV(csvText, {
      skipFirstRow: true,
      separator: sep,
      trimLeadingSpace: true,
    }) as Record<string, string>[]
  } catch (e) {
    throw new Error(`Error parseando CSV: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (rawRows.length === 0) {
    return {
      rows: [],
      validationResult: { is_valid: false, errors: ['CSV vacío o sin filas de datos'], warnings: [], row_count: 0 },
    }
  }

  // Función para parsear número con el separador decimal correcto
  const parseNum = (s: string): number => {
    if (!s || s.trim() === '') return 0
    let clean = s.trim().replace(/\s/g, '')
    if (decimalSep === ',') {
      // 1.234,56 → 1234.56
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 → 1234.56
      clean = clean.replace(/,/g, '')
    }
    const n = parseFloat(clean)
    return isNaN(n) ? 0 : n
  }

  // Construir mapeo inverso: campo_interno → nombre_columna_ERP
  // Si no hay mapeo configurado, usar el nombre interno directamente
  const getCol = (internal: string): string => colMap[internal] ?? internal

  // Detectar columnas presentes en el CSV
  const csvHeaders = Object.keys(rawRows[0] ?? {})
  const requiredInternal = ['cliente_codigo', 'importe_total', 'margen', 'categoria']
  const errors: string[] = []
  const warnings: string[] = []

  for (const field of requiredInternal) {
    const erpCol = getCol(field)
    if (!csvHeaders.includes(erpCol)) {
      errors.push(`Columna requerida no encontrada: "${erpCol}" (campo: ${field})`)
    }
  }

  const rows: ParsedRow[] = []
  let skipped = 0

  for (const raw of rawRows) {
    const clienteCodigo = (raw[getCol('cliente_codigo')] ?? '').trim()
    const importeStr = raw[getCol('importe_total')] ?? ''
    const margenStr  = raw[getCol('margen')] ?? ''

    if (!clienteCodigo) { skipped++; continue }

    const importeTotal = parseNum(importeStr)
    if (importeTotal <= 0) { skipped++; continue }

    let categoria = (raw[getCol('categoria')] ?? '').trim()
    // Aplicar mapeo de categorías si existe
    if (catMap[categoria]) categoria = catMap[categoria]

    rows.push({
      fecha:            (raw[getCol('fecha')] ?? '').trim(),
      cliente_codigo:   clienteCodigo,
      cliente_nombre:   (raw[getCol('cliente_nombre')] ?? clienteCodigo).trim(),
      categoria:        categoria || 'Sin categoría',
      comercial:        (raw[getCol('comercial')] ?? '').trim(),
      cantidad:         parseNum(raw[getCol('cantidad')] ?? ''),
      margen:           parseNum(margenStr),
      importe_total:    importeTotal,
      producto_codigo:  (raw[getCol('producto_codigo')] ?? '').trim(),
      producto_nombre:  (raw[getCol('producto_nombre')] ?? '').trim(),
    })
  }

  if (skipped > rawRows.length * 0.2) {
    warnings.push(`Se omitieron ${skipped} filas (${Math.round(skipped / rawRows.length * 100)}%) por datos incompletos`)
  }

  return {
    rows,
    validationResult: {
      is_valid: errors.length === 0,
      errors,
      warnings,
      row_count: rows.length,
      skipped_rows: skipped,
      columns_detected: csvHeaders,
    },
  }
}

// ─── Motor de KPIs y oportunidades ───────────────────────────────────────────

function calculateKPIs(rows: ParsedRow[]) {
  // ── Agrupaciones base ───────────────────────────────────────────────────

  // Por cliente
  const clienteMap = new Map<string, {
    nombre: string; comercial: string
    importe: number; margenPonderado: number; importePonderado: number
    categorias: Set<string>; productos: Set<string>
  }>()

  // Por categoría
  const catMap = new Map<string, { importe: number; margenPond: number; importePond: number }>()

  // Por comercial
  const comMap = new Map<string, { clientes: Set<string>; importe: number; margenPond: number; importePond: number }>()

  // Por producto
  const prodMap = new Map<string, { clientes: Set<string>; importe: number; nombre: string }>()

  for (const row of rows) {
    // --- cliente ---
    if (!clienteMap.has(row.cliente_codigo)) {
      clienteMap.set(row.cliente_codigo, {
        nombre: row.cliente_nombre,
        comercial: row.comercial,
        importe: 0, margenPonderado: 0, importePonderado: 0,
        categorias: new Set(), productos: new Set(),
      })
    }
    const cli = clienteMap.get(row.cliente_codigo)!
    cli.importe += row.importe_total
    cli.margenPonderado += row.margen * row.importe_total
    cli.importePonderado += row.importe_total
    if (row.categoria) cli.categorias.add(row.categoria)
    if (row.producto_codigo) cli.productos.add(row.producto_codigo)

    // --- categoria ---
    if (!catMap.has(row.categoria)) catMap.set(row.categoria, { importe: 0, margenPond: 0, importePond: 0 })
    const cat = catMap.get(row.categoria)!
    cat.importe += row.importe_total
    cat.margenPond += row.margen * row.importe_total
    cat.importePond += row.importe_total

    // --- comercial ---
    if (row.comercial) {
      if (!comMap.has(row.comercial)) comMap.set(row.comercial, { clientes: new Set(), importe: 0, margenPond: 0, importePond: 0 })
      const com = comMap.get(row.comercial)!
      com.clientes.add(row.cliente_codigo)
      com.importe += row.importe_total
      com.margenPond += row.margen * row.importe_total
      com.importePond += row.importe_total
    }

    // --- producto ---
    if (row.producto_codigo) {
      if (!prodMap.has(row.producto_codigo)) prodMap.set(row.producto_codigo, { clientes: new Set(), importe: 0, nombre: row.producto_nombre })
      const prod = prodMap.get(row.producto_codigo)!
      prod.clientes.add(row.cliente_codigo)
      prod.importe += row.importe_total
    }
  }

  const totalImporte = rows.reduce((s, r) => s + r.importe_total, 0)
  const globalMargenPct = totalImporte > 0
    ? rows.reduce((s, r) => s + r.margen * r.importe_total, 0) / totalImporte
    : 0

  const totalClientes = clienteMap.size

  // ── extended_data: margen_por_categoria ─────────────────────────────────

  const margenPorCategoria = Array.from(catMap.entries())
    .map(([cat, d]) => ({
      categoria: cat,
      margen_pct: d.importePond > 0 ? Math.round((d.margenPond / d.importePond) * 10) / 10 : 0,
      facturacion: Math.round(d.importe),
    }))
    .sort((a, b) => b.facturacion - a.facturacion)

  const topCategoria = margenPorCategoria[0]?.categoria ?? null

  // Categoría con mayor potencial = la de mayor facturación cuyo margen está más por debajo
  const catConPotencial = margenPorCategoria
    .filter(c => c.margen_pct < globalMargenPct * 0.9)
    .sort((a, b) => b.facturacion - a.facturacion)
  const categoriaMayorPotencial = catConPotencial[0]?.categoria ?? topCategoria

  // ── extended_data: comerciales ──────────────────────────────────────────

  const comerciales = Array.from(comMap.entries())
    .map(([nombre, d]) => {
      const margenCom = d.importePond > 0 ? d.margenPond / d.importePond : 0
      const potencial = d.importe * Math.max(0, globalMargenPct - margenCom) / 100
      return {
        nombre_erp: nombre,
        n_clientes: d.clientes.size,
        facturacion: Math.round(d.importe),
        margen_pct: Math.round(margenCom * 10) / 10,
        potencial_mes: Math.round(potencial / 12),
      }
    })
    .sort((a, b) => b.potencial_mes - a.potencial_mes)

  // ── Detección de oportunidades ──────────────────────────────────────────

  const oportunidades: Array<{
    cliente_codigo: string; cliente_nombre: string
    tipo: string; potencial_mes: number
  }> = []

  // Umbral: categorías que representan >6% de la facturación total
  const catSignificativas = margenPorCategoria
    .filter(c => c.facturacion / totalImporte > 0.06)
    .map(c => c.categoria)

  // Productos con penetración >25% del total de clientes
  const prodComunes = Array.from(prodMap.entries())
    .filter(([, d]) => d.clientes.size / totalClientes > 0.25)
    .map(([code]) => code)

  const importeMedianoCliente = mediana(Array.from(clienteMap.values()).map(c => c.importe))

  for (const [codigo, cli] of clienteMap.entries()) {
    const clienteMargenPct = cli.importePonderado > 0 ? cli.margenPonderado / cli.importePonderado : 0

    // 1. MIX_SUBOPTIMO: margen 15% por debajo de la media global
    if (clienteMargenPct < globalMargenPct * 0.85 && cli.importe > importeMedianoCliente * 0.3) {
      const potencial = cli.importe * (globalMargenPct - clienteMargenPct) / 100 / 12
      if (potencial > 50) {
        oportunidades.push({
          cliente_codigo: codigo,
          cliente_nombre: cli.nombre,
          tipo: 'mix_suboptimo',
          potencial_mes: Math.round(potencial),
        })
      }
    }

    // 2. CATEGORIA_PERDIDA: cliente no compra una categoría significativa
    for (const cat of catSignificativas) {
      if (!cli.categorias.has(cat)) {
        const catData = catMap.get(cat)!
        const avgPurchaseInCat = catData.importe / clienteMap.size
        const potencial = avgPurchaseInCat * (catData.importePond > 0 ? catData.margenPond / catData.importePond : globalMargenPct) / 100 / 12
        if (potencial > 30) {
          oportunidades.push({
            cliente_codigo: codigo,
            cliente_nombre: cli.nombre,
            tipo: 'categoria_perdida',
            potencial_mes: Math.round(potencial),
          })
          break // máximo 1 oportunidad de este tipo por cliente
        }
      }
    }

    // 3. PRODUCTO_NO_OFRECIDO: productos comunes que el cliente no compra (máx 1 por cliente)
    const prodFaltante = prodComunes.find(p => !cli.productos.has(p))
    if (prodFaltante) {
      const pd = prodMap.get(prodFaltante)!
      const avgRevPerClient = pd.importe / pd.clientes.size
      const potencial = avgRevPerClient * globalMargenPct / 100 / 12
      if (potencial > 20) {
        oportunidades.push({
          cliente_codigo: codigo,
          cliente_nombre: cli.nombre,
          tipo: 'producto_no_ofrecido',
          potencial_mes: Math.round(potencial),
        })
      }
    }
  }

  // ── Detección de riesgo ─────────────────────────────────────────────────

  const riesgo: Array<{
    cliente_codigo: string; cliente_nombre: string
    severidad: string; caida_pct: number; impacto_mes: number
  }> = []

  for (const [codigo, cli] of clienteMap.entries()) {
    const clienteMargenPct = cli.importePonderado > 0 ? cli.margenPonderado / cli.importePonderado : 0
    const impactoMes = Math.round(cli.importe / 12)
    const caida = Math.round((clienteMargenPct - globalMargenPct) * 10) / 10  // diferencia vs media

    if (clienteMargenPct < globalMargenPct * 0.5 && cli.importe > importeMedianoCliente) {
      riesgo.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, severidad: 'CRITICO', caida_pct: caida, impacto_mes: impactoMes })
    } else if (clienteMargenPct < globalMargenPct * 0.7 && cli.importe > importeMedianoCliente * 0.5) {
      riesgo.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, severidad: 'ATENCION', caida_pct: caida, impacto_mes: impactoMes })
    } else if (clienteMargenPct < globalMargenPct * 0.85 && cli.importe > importeMedianoCliente * 2) {
      // Cliente grande con margen por debajo: riesgo latente
      riesgo.push({ cliente_codigo: codigo, cliente_nombre: cli.nombre, severidad: 'SEGUIMIENTO', caida_pct: caida, impacto_mes: impactoMes })
    }
  }

  riesgo.sort((a, b) => {
    const order: Record<string, number> = { CRITICO: 0, ATENCION: 1, SEGUIMIENTO: 2 }
    return (order[a.severidad] ?? 9) - (order[b.severidad] ?? 9) || b.impacto_mes - a.impacto_mes
  })

  // ── Agrupación de oportunidades por tipo ────────────────────────────────

  const oportunidadesPorTipo = {
    categoria_perdida:    oportunidades.filter(o => o.tipo === 'categoria_perdida').length,
    mix_suboptimo:        oportunidades.filter(o => o.tipo === 'mix_suboptimo').length,
    cliente_caida:        0, // requiere datos históricos
    producto_no_ofrecido: oportunidades.filter(o => o.tipo === 'producto_no_ofrecido').length,
  }

  const potencialMensualTotal = Math.round(oportunidades.reduce((s, o) => s + o.potencial_mes, 0))

  // ── Datos comerciales con potencial ────────────────────────────────────

  // Sumar potencial de las oportunidades de los clientes de cada comercial
  for (const com of comerciales) {
    const clientesDelComercial = new Set(
      Array.from(clienteMap.entries())
        .filter(([, c]) => c.comercial === com.nombre_erp)
        .map(([code]) => code)
    )
    com.potencial_mes = Math.round(
      oportunidades
        .filter(o => clientesDelComercial.has(o.cliente_codigo))
        .reduce((s, o) => s + o.potencial_mes, 0)
    )
  }

  return {
    kpis: {
      facturacion_total: Math.round(totalImporte),
      margen_porcentaje: Math.round(globalMargenPct * 10) / 10,
      potencial_mensual: potencialMensualTotal,
      potencial_anual: potencialMensualTotal * 12,
      total_oportunidades: oportunidades.length,
      clientes_activos: totalClientes,
      top_categoria: topCategoria,
      categoria_mayor_potencial: categoriaMayorPotencial,
      oportunidades_por_tipo: oportunidadesPorTipo,
    },
    extendedData: {
      margen_por_categoria: margenPorCategoria,
      oportunidades_detalle: oportunidades
        .sort((a, b) => b.potencial_mes - a.potencial_mes)
        .slice(0, 50), // top 50
      comerciales,
      riesgo: riesgo.slice(0, 30),
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mediana(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
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
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
