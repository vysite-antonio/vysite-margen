'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertErpProfile, deleteErpProfile, ErpFileType } from '@/lib/actions/admin'

// ─── Definición de campos internos ───────────────────────────────────────────

const INTERNAL_FIELDS: { key: string; label: string; group: string; optional?: boolean }[] = [
  // Identificación
  { key: 'referencia',         label: 'Referencia/nº documento', group: 'Identificación', optional: true },
  { key: 'fecha',              label: 'Fecha',                    group: 'Identificación' },
  // Cliente
  { key: 'cliente',            label: 'Nombre del cliente',       group: 'Cliente' },
  { key: 'cliente_codigo',     label: 'Código de cliente',        group: 'Cliente', optional: true },
  // Comercial
  { key: 'comercial',          label: 'Nombre del comercial',     group: 'Comercial', optional: true },
  // Importes
  { key: 'importe',            label: 'Importe total (con IVA)',  group: 'Importes' },
  { key: 'base_imponible',     label: 'Base imponible (sin IVA)', group: 'Importes', optional: true },
  { key: 'descuento',          label: 'Descuento (%)',            group: 'Importes', optional: true },
  // Cobro
  { key: 'estado_cobro',       label: 'Estado de cobro',          group: 'Cobro', optional: true },
  { key: 'importe_cobrado',    label: 'Importe cobrado',          group: 'Cobro', optional: true },
  { key: 'importe_pendiente',  label: 'Importe pendiente',        group: 'Cobro', optional: true },
  // Producto / Líneas
  { key: 'producto_codigo',    label: 'Código de producto',       group: 'Producto', optional: true },
  { key: 'producto',           label: 'Nombre del producto',      group: 'Producto', optional: true },
  { key: 'categoria',          label: 'Familia / Categoría',      group: 'Producto', optional: true },
  { key: 'cantidad',           label: 'Cantidad',                 group: 'Producto', optional: true },
  { key: 'precio_unitario',    label: 'Precio unitario',          group: 'Producto', optional: true },
  { key: 'coste',              label: 'Coste',                    group: 'Producto', optional: true },
  { key: 'margen',             label: 'Margen calculado (%)',     group: 'Producto', optional: true },
]

const ALL_CAPABILITIES = [
  { key: 'facturacion_cliente',    label: 'Facturación por cliente' },
  { key: 'facturacion_comercial',  label: 'Facturación por comercial' },
  { key: 'riesgo_cobro',           label: 'Riesgo de cobro (impagos)' },
  { key: 'tendencia_temporal',     label: 'Tendencia temporal' },
  { key: 'margen_categoria',       label: 'Margen por categoría' },
  { key: 'oportunidades_mix',      label: 'Oportunidades: mix subóptimo' },
  { key: 'oportunidades_categoria',label: 'Oportunidades: categoría perdida' },
  { key: 'riesgo_cliente',         label: 'Riesgo: cliente en caída' },
  { key: 'segmentacion_cliente',   label: 'Segmentación de clientes' },
]

const EMPTY_FILE_TYPE: ErpFileType = {
  key: '',
  label: '',
  description: '',
  encoding: 'utf-8',
  separator: ';',
  column_mapping: {},
  required_columns: [],
  analysis_capabilities: [],
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  profileId: string | null
  initialName?: string
  initialSlug?: string
  initialDescription?: string
  initialFileTypes?: ErpFileType[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ErpProfileEditor({
  profileId,
  initialName = '',
  initialSlug = '',
  initialDescription = '',
  initialFileTypes = [],
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [description, setDescription] = useState(initialDescription)
  const [fileTypes, setFileTypes] = useState<ErpFileType[]>(
    initialFileTypes.length > 0 ? initialFileTypes : [{ ...EMPTY_FILE_TYPE }]
  )
  const [activeFileTypeIdx, setActiveFileTypeIdx] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── Auto-slug desde nombre ────────────────────────────────────────────────
  function handleNameChange(v: string) {
    setName(v)
    if (!profileId) {
      setSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    }
    setSaved(false)
  }

  // ── Helpers para fileTypes ────────────────────────────────────────────────
  function updateFileType(idx: number, patch: Partial<ErpFileType>) {
    setFileTypes(prev => prev.map((ft, i) => i === idx ? { ...ft, ...patch } : ft))
    setSaved(false)
  }

  function updateColumnMapping(ftIdx: number, field: string, colName: string) {
    setFileTypes(prev => prev.map((ft, i) => {
      if (i !== ftIdx) return ft
      const newMapping = { ...ft.column_mapping, [field]: colName }
      if (!colName) delete newMapping[field]
      // Actualizar required_columns automáticamente: campos no-opcional con valor
      const required = INTERNAL_FIELDS
        .filter(f => !f.optional && newMapping[f.key])
        .map(f => newMapping[f.key])
      return { ...ft, column_mapping: newMapping, required_columns: required }
    }))
    setSaved(false)
  }

  function toggleCapability(ftIdx: number, capKey: string) {
    setFileTypes(prev => prev.map((ft, i) => {
      if (i !== ftIdx) return ft
      const has = ft.analysis_capabilities.includes(capKey)
      return {
        ...ft,
        analysis_capabilities: has
          ? ft.analysis_capabilities.filter(c => c !== capKey)
          : [...ft.analysis_capabilities, capKey]
      }
    }))
    setSaved(false)
  }

  function addFileType() {
    setFileTypes(prev => [...prev, { ...EMPTY_FILE_TYPE }])
    setActiveFileTypeIdx(fileTypes.length)
    setSaved(false)
  }

  function removeFileType(idx: number) {
    setFileTypes(prev => prev.filter((_, i) => i !== idx))
    setActiveFileTypeIdx(Math.max(0, idx - 1))
    setSaved(false)
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  function handleSave() {
    setError(null)
    setSaved(false)
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    if (!slug.trim()) { setError('El slug es obligatorio'); return }
    if (fileTypes.some(ft => !ft.key || !ft.label)) {
      setError('Cada tipo de fichero debe tener clave y etiqueta')
      return
    }

    startTransition(async () => {
      const result = await upsertErpProfile(profileId, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        file_types: fileTypes,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        if (!profileId && result.id) {
          router.push(`/admin/erp-profiles/${slug.trim()}`)
        } else {
          router.refresh()
        }
      }
    })
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!profileId) return
    startTransition(async () => {
      const result = await deleteErpProfile(profileId)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/admin/erp-profiles')
        router.refresh()
      }
    })
  }

  const ft = fileTypes[activeFileTypeIdx]
  const fieldGroups = INTERNAL_FIELDS.reduce<Record<string, typeof INTERNAL_FIELDS>>((acc, f) => {
    acc[f.group] = acc[f.group] ? [...acc[f.group], f] : [f]
    return acc
  }, {})

  return (
    <div className="space-y-6">

      {/* ── Info general ─────────────────────────────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-sm mb-5">Información del perfil</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-slate-400 text-xs block mb-1.5">Nombre del ERP *</label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="p.ej. StelOrder"
              className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1.5">
              Slug (identificador interno) *
            </label>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSaved(false) }}
              placeholder="p.ej. stelorder"
              className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none transition-colors placeholder:text-slate-600"
            />
          </div>
        </div>
        <div>
          <label className="text-slate-400 text-xs block mb-1.5">Descripción breve</label>
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); setSaved(false) }}
            placeholder="Descripción del ERP y sus características principales..."
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors resize-none placeholder:text-slate-600"
          />
        </div>
      </section>

      {/* ── Tipos de fichero ──────────────────────────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-sm">Tipos de fichero CSV</h2>
            <p className="text-slate-500 text-xs mt-0.5">Cada ERP puede exportar distintos tipos de fichero con columnas diferentes.</p>
          </div>
          <button
            onClick={addFileType}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Añadir tipo
          </button>
        </div>

        {/* Tabs por tipo de fichero */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {fileTypes.map((ft, i) => (
            <button
              key={i}
              onClick={() => setActiveFileTypeIdx(i)}
              className={`flex-shrink-0 text-xs px-4 py-1.5 rounded-lg border transition-colors ${
                activeFileTypeIdx === i
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {ft.label || `Tipo ${i + 1}`}
            </button>
          ))}
        </div>

        {ft && (
          <div className="space-y-6">
            {/* Metadatos del tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Clave interna *</label>
                <input
                  type="text"
                  value={ft.key}
                  onChange={e => updateFileType(activeFileTypeIdx, { key: e.target.value })}
                  placeholder="p.ej. facturas"
                  className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none transition-colors placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Nombre visible *</label>
                <input
                  type="text"
                  value={ft.label}
                  onChange={e => updateFileType(activeFileTypeIdx, { label: e.target.value })}
                  placeholder="p.ej. Facturas"
                  className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Codificación</label>
                <select
                  value={ft.encoding}
                  onChange={e => updateFileType(activeFileTypeIdx, { encoding: e.target.value as 'utf-8' | 'windows-1252' })}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors"
                >
                  <option value="utf-8">UTF-8 (estándar)</option>
                  <option value="windows-1252">Windows-1252 (legacy)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Separador</label>
                <select
                  value={ft.separator}
                  onChange={e => updateFileType(activeFileTypeIdx, { separator: e.target.value as ';' | ',' })}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors"
                >
                  <option value=";">Punto y coma ( ; )</option>
                  <option value=",">Coma ( , )</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1.5">
                Instrucciones de exportación para el cliente
              </label>
              <textarea
                value={ft.description}
                onChange={e => updateFileType(activeFileTypeIdx, { description: e.target.value })}
                placeholder="Describe paso a paso cómo el cliente debe exportar este fichero desde el ERP..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors resize-none placeholder:text-slate-600"
              />
              <p className="text-slate-600 text-xs mt-1">Estas instrucciones se mostrarán al cliente durante la subida de CSV.</p>
            </div>

            {/* Mapeo de columnas */}
            <div>
              <h3 className="text-white font-medium text-sm mb-1">Mapeo de columnas</h3>
              <p className="text-slate-500 text-xs mb-4">
                Escribe el nombre exacto de la columna tal como aparece en el CSV de este ERP.
                Los campos sin valor se ignorarán.
              </p>
              <div className="space-y-5">
                {Object.entries(fieldGroups).map(([group, fields]) => (
                  <div key={group}>
                    <p className="text-slate-600 text-xs font-medium uppercase tracking-wider mb-2">{group}</p>
                    <div className="space-y-2">
                      {fields.map(field => (
                        <div key={field.key} className="flex items-center gap-3">
                          <div className="w-48 flex-shrink-0">
                            <span className={`text-xs ${field.optional ? 'text-slate-500' : 'text-slate-300'}`}>
                              {field.label}
                              {!field.optional && <span className="text-emerald-400 ml-0.5">*</span>}
                            </span>
                          </div>
                          <span className="text-slate-600 text-xs flex-shrink-0">→</span>
                          <input
                            type="text"
                            value={ft.column_mapping[field.key] ?? ''}
                            onChange={e => updateColumnMapping(activeFileTypeIdx, field.key, e.target.value)}
                            placeholder={field.optional ? 'Opcional' : 'Nombre de columna en el ERP'}
                            className="flex-1 bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-white text-sm font-mono outline-none transition-colors placeholder:text-slate-600 placeholder:not-italic placeholder:font-sans"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Capacidades de análisis */}
            <div>
              <h3 className="text-white font-medium text-sm mb-1">Análisis disponibles</h3>
              <p className="text-slate-500 text-xs mb-4">
                Marca los análisis que es posible realizar con este tipo de fichero.
                El dashboard mostrará solo los módulos compatibles.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_CAPABILITIES.map(cap => (
                  <label
                    key={cap.key}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      ft.analysis_capabilities.includes(cap.key)
                        ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ft.analysis_capabilities.includes(cap.key)}
                      onChange={() => toggleCapability(activeFileTypeIdx, cap.key)}
                      className="accent-emerald-500"
                    />
                    <span className="text-xs">{cap.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Eliminar tipo de fichero */}
            {fileTypes.length > 1 && (
              <div className="flex justify-end">
                <button
                  onClick={() => removeFileType(activeFileTypeIdx)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Eliminar tipo «{ft.label || ft.key}»
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Footer: guardar / eliminar ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {profileId && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-xs">¿Confirmar eliminación?</span>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Sí, eliminar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                Eliminar perfil
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-4">
          {saved && <span className="text-emerald-400 text-sm">✓ Cambios guardados</span>}
          {error && <span className="text-red-400 text-sm">{error}</span>}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {isPending ? 'Guardando…' : profileId ? 'Guardar cambios' : 'Crear perfil'}
          </button>
        </div>
      </div>
    </div>
  )
}
