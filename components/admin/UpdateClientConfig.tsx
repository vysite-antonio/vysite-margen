'use client'

import { useState, useTransition } from 'react'
import { updateClientConfig } from '@/lib/actions/admin'
import Link from 'next/link'

interface ErpProfile {
  id: string
  name: string
  slug: string
  file_types: Array<{ key: string; label: string; analysis_capabilities: string[] }>
}

interface Props {
  clientId: string
  config: Record<string, unknown>
  plan: string
  erpComerciales: string[]
  erpProfiles: ErpProfile[]
  currentErpProfileId: string | null
}

const PLAN_OPTIONS = [
  { value: 'inicio',      label: 'Plan Inicio',      desc: 'Drive + Resumen + Margen' },
  { value: 'crecimiento', label: 'Plan Crecimiento',  desc: '+ Oportunidades' },
  { value: 'estrategico', label: 'Plan Estratégico',  desc: '+ Comerciales + Riesgo' },
]

const CAPABILITY_LABELS: Record<string, string> = {
  facturacion_cliente:     'Facturación/cliente',
  facturacion_comercial:   'Facturación/comercial',
  riesgo_cobro:            'Riesgo de cobro',
  tendencia_temporal:      'Tendencia temporal',
  margen_categoria:        'Margen por categoría',
  oportunidades_mix:       'Oportunidades mix',
  oportunidades_categoria: 'Oportunidades categoría',
  riesgo_cliente:          'Riesgo de cliente',
  segmentacion_cliente:    'Segmentación',
}

export default function UpdateClientConfig({
  clientId,
  config,
  plan,
  erpComerciales,
  erpProfiles,
  currentErpProfileId,
}: Props) {
  const [currentPlan, setCurrentPlan]         = useState(plan)
  const [selectedErpId, setSelectedErpId]     = useState<string | null>(currentErpProfileId)
  const [displayNames, setDisplayNames]        = useState<Record<string, string>>(
    (config?.comercial_display_names as Record<string, string>) ?? {}
  )
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedProfile = erpProfiles.find(p => p.id === selectedErpId) ?? null
  const allCaps = selectedProfile
    ? [...new Set(selectedProfile.file_types.flatMap(ft => ft.analysis_capabilities ?? []))]
    : []

  function handleNameChange(erpName: string, displayName: string) {
    setDisplayNames(prev => ({ ...prev, [erpName]: displayName }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateClientConfig(clientId, {
        plan: currentPlan,
        comercial_display_names: displayNames,
        erp_profile_id: selectedErpId,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="space-y-6">

      {/* ── Plan ──────────────────────────────────────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-sm mb-4">Plan de acceso</h2>
        <div className="grid grid-cols-1 gap-3">
          {PLAN_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                currentPlan === opt.value
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="plan"
                value={opt.value}
                checked={currentPlan === opt.value}
                onChange={() => { setCurrentPlan(opt.value); setSaved(false) }}
                className="accent-emerald-500"
              />
              <div>
                <p className="text-white text-sm font-medium">{opt.label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Perfil ERP ─────────────────────────────────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-white font-semibold text-sm">Perfil ERP</h2>
          <Link
            href="/admin/erp-profiles"
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Gestionar perfiles →
          </Link>
        </div>
        <p className="text-slate-400 text-xs mb-4">
          Selecciona el ERP que usa este cliente. Define qué columnas se esperan en sus CSVs y qué análisis están disponibles.
        </p>

        {erpProfiles.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <p className="text-slate-400 text-sm mb-2">No hay perfiles ERP configurados.</p>
            <Link href="/admin/erp-profiles/new"
              className="text-emerald-400 text-xs hover:underline">
              Crear primer perfil →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Opción "Sin asignar" */}
            <label
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                selectedErpId === null
                  ? 'border-slate-500/50 bg-slate-800'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="erp_profile"
                checked={selectedErpId === null}
                onChange={() => { setSelectedErpId(null); setSaved(false) }}
                className="accent-emerald-500"
              />
              <div>
                <p className="text-slate-400 text-sm">Sin perfil asignado</p>
                <p className="text-slate-600 text-xs mt-0.5">El sistema intentará detectar el formato automáticamente.</p>
              </div>
            </label>

            {erpProfiles.map(profile => {
              const caps = [...new Set(profile.file_types.flatMap(ft => ft.analysis_capabilities ?? []))]
              return (
                <label
                  key={profile.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                    selectedErpId === profile.id
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="erp_profile"
                    checked={selectedErpId === profile.id}
                    onChange={() => { setSelectedErpId(profile.id); setSaved(false) }}
                    className="accent-emerald-500 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{profile.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {profile.file_types.map(ft => (
                        <span key={ft.key}
                          className="text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full">
                          {ft.label}
                        </span>
                      ))}
                    </div>
                    {caps.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {caps.slice(0, 3).map(cap => (
                          <span key={cap}
                            className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                            {CAPABILITY_LABELS[cap] ?? cap}
                          </span>
                        ))}
                        {caps.length > 3 && (
                          <span className="text-xs text-slate-600 px-1">+{caps.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Nombres de comerciales ─────────────────────────────────────────── */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-white font-semibold text-sm">Nombres de comerciales</h2>
        </div>
        <p className="text-slate-400 text-xs mb-5">
          Asigna un nombre visible para cada comercial detectado en el ERP. Si no lo cambias se mostrará el nombre original.
        </p>

        {erpComerciales.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            No se han detectado comerciales en el último análisis. Se mostrarán aquí tras procesar el primer CSV.
          </p>
        ) : (
          <div className="space-y-3">
            {erpComerciales.map(erpName => (
              <div key={erpName} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-slate-500 text-xs mb-1">Nombre en el ERP</p>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-400 text-sm font-mono">{erpName}</span>
                  </div>
                </div>
                <div className="text-slate-600 text-lg mt-4">→</div>
                <div className="flex-1">
                  <p className="text-slate-500 text-xs mb-1">Nombre a mostrar</p>
                  <input
                    type="text"
                    value={displayNames[erpName] ?? ''}
                    onChange={e => handleNameChange(erpName, e.target.value)}
                    placeholder={erpName}
                    className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors placeholder:text-slate-600"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          {saved && <span className="text-emerald-400 text-sm font-medium">✓ Cambios guardados</span>}
          {error && <span className="text-red-400 text-sm">{error}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
