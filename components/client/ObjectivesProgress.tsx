'use client'

import { useState } from 'react'
import { calcObjectiveProgress, extractCurrentValue } from '@/lib/utils/objectives'
import type { Objective, ObjectiveProgress } from '@/lib/utils/objectives'
import type { KPIs } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}
function fmtVal(n: number, metric: string) {
  if (metric === 'margin_pct') return (n * 100).toFixed(1) + '%'
  if (metric === 'units' || metric === 'new_clients') return n.toLocaleString('es-ES')
  return eur(n)
}
function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
}

const METRIC_LABELS: Record<string, string> = {
  revenue: 'Facturación', margin: 'Margen', margin_pct: 'Margen %',
  units: 'Unidades', new_clients: 'Clientes nuevos',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  objectives:  Objective[]
  kpis:        KPIs | null
  comercialId?: string   // si viene un comercialId, filtramos por asignación
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ObjectivesProgress({ objectives, kpis, comercialId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const today   = new Date().toISOString().split('T')[0]
  const extData = kpis?.extended_data as Record<string, unknown> | null ?? null

  // Filtrar activos y del período actual
  const activeObjs = objectives.filter(o => {
    if (!o.active) return false
    if (o.start_date > today || o.end_date < today) return false
    if (comercialId) {
      return o.applies_to === 'all' || o.comercial_ids.includes(comercialId)
    }
    return true
  })

  const futureObjs = objectives.filter(o => o.active && o.start_date > today)

  if (activeObjs.length === 0 && futureObjs.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
        <div className="text-4xl mb-3">🎯</div>
        <h3 className="text-white font-semibold text-sm mb-2">Sin objetivos activos</h3>
        <p className="text-slate-500 text-xs max-w-xs mx-auto">
          Tu responsable configurará los objetivos de este período. Aparecerán aquí en cuanto estén listos.
        </p>
      </div>
    )
  }

  const progressList = activeObjs.map(obj => ({
    obj,
    progress: calcObjectiveProgress(obj, extractCurrentValue(obj, extData)),
  }))

  const selected = selectedId ? progressList.find(p => p.obj.id === selectedId) : null

  return (
    <div className="space-y-5">

      {/* KPI rápido global */}
      {progressList.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            label="Objetivos activos"
            value={String(progressList.length)}
            sub="este período"
          />
          <KpiCard
            label="Cumplimiento medio"
            value={Math.round(progressList.reduce((a,p) => a + p.progress.pct_completed, 0) / progressList.length) + '%'}
            sub="sobre todos los objetivos"
            highlight={progressList.every(p => p.progress.pct_completed >= 80)}
          />
          <KpiCard
            label="Comisión estimada"
            value={eur(progressList.reduce((a,p) => a + p.progress.estimated_commission, 0))}
            sub="al ritmo actual"
            highlight
          />
        </div>
      )}

      {/* Listado de objetivos activos */}
      <div className="space-y-3">
        <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wide">
          Objetivos en curso
        </h3>

        {progressList.map(({ obj, progress: prog }) => {
          const pctCap   = Math.min(100, prog.pct_completed)
          const barColor = pctCap >= 100 ? 'bg-emerald-500' : pctCap >= 80 ? 'bg-amber-500' : pctCap >= 50 ? 'bg-blue-500' : 'bg-slate-500'
          const isExpanded = selectedId === obj.id

          return (
            <div key={obj.id}
              className={`bg-slate-900 border rounded-xl overflow-hidden transition-all cursor-pointer
                ${isExpanded ? 'border-emerald-700/50' : 'border-slate-800 hover:border-slate-700'}`}
              onClick={() => setSelectedId(isExpanded ? null : obj.id)}
            >
              {/* Cabecera siempre visible */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{obj.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {fmtDate(obj.start_date)} → {fmtDate(obj.end_date)}
                      {' · '}{prog.days_remaining}d restantes
                    </p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${pctCap >= 100 ? 'text-emerald-400' : pctCap >= 80 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {Math.round(prog.pct_completed)}%
                  </span>
                </div>

                {/* Barra de progreso */}
                <div className="space-y-1.5">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pctCap}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">
                      {fmtVal(prog.current_value, obj.metric)} de {fmtVal(obj.target_value, obj.metric)}
                    </span>
                    <span className={`text-xs ${prog.on_track ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {prog.on_track ? '✓ Al ritmo' : '⚠ Retrasado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="border-t border-slate-800 p-4 space-y-4 bg-slate-900/30">

                  {/* Lo que falta */}
                  {prog.remaining > 0 ? (
                    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                      <p className="text-slate-400 text-xs mb-1">Para alcanzar el objetivo:</p>
                      <p className="text-white text-sm font-semibold">
                        Faltan <span className="text-amber-400">{fmtVal(prog.remaining, obj.metric)}</span>
                        {obj.scope_type !== 'all' && obj.scope_values.length > 0 && (
                          <span className="text-slate-400 font-normal"> en {obj.scope_values.join(', ')}</span>
                        )}
                      </p>
                      {prog.days_remaining > 0 && (
                        <p className="text-slate-500 text-xs mt-1">
                          Ritmo necesario: {fmtVal(prog.remaining / prog.days_remaining, obj.metric)}/día en los próximos {prog.days_remaining} días
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-3 text-center">
                      <p className="text-emerald-400 text-sm font-semibold">🎉 ¡Objetivo alcanzado!</p>
                    </div>
                  )}

                  {/* Métricas de seguimiento */}
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Período consumido" value={Math.round(prog.pct_period_elapsed) + '%'} />
                    <MiniStat label="Días totales" value={String(prog.days_total)} />
                    <MiniStat label="Métrica" value={METRIC_LABELS[obj.metric] ?? obj.metric} />
                  </div>

                  {/* Comisión */}
                  {obj.commission_type !== 'none' && (
                    <div>
                      <p className="text-slate-500 text-xs mb-2">Comisión por tramos de cumplimiento</p>
                      {obj.commission_type === 'tiered' && obj.commission_config.tiers ? (
                        <div className="space-y-1.5">
                          {[...obj.commission_config.tiers]
                            .sort((a, b) => a.threshold_pct - b.threshold_pct)
                            .map((tier, i) => {
                              const reached = prog.pct_completed >= tier.threshold_pct
                              return (
                                <div key={i}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs
                                    ${reached
                                      ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                                      : 'bg-slate-800/40 border-slate-700 text-slate-400'}`}>
                                  <span>{reached ? '✓' : '○'} Al {tier.threshold_pct}%</span>
                                  <span className="font-semibold">
                                    {tier.type === 'bonus' ? eur(tier.value) : `${tier.value}%`}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-2">
                          <span className="text-slate-400 text-xs">Comisión estimada actual</span>
                          <span className="text-emerald-400 text-sm font-semibold">{eur(prog.estimated_commission)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Próximos objetivos */}
      {futureObjs.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">Próximos objetivos</h3>
          <div className="space-y-2">
            {futureObjs.map(obj => (
              <div key={obj.id} className="flex items-center gap-3 bg-slate-900/50 border border-dashed border-slate-700 rounded-xl px-4 py-3 opacity-70">
                <span className="text-slate-500 text-sm">🗓</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm truncate">{obj.name}</p>
                  <p className="text-slate-600 text-xs">Empieza el {fmtDate(obj.start_date)}</p>
                </div>
                <p className="text-slate-400 text-xs shrink-0">
                  {fmtVal(obj.target_value, obj.metric)} de {METRIC_LABELS[obj.metric] ?? obj.metric}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'bg-emerald-950/30 border-emerald-800/40' : 'bg-slate-900 border-slate-800'}`}>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
      <p className="text-slate-600 text-[10px] mt-0.5">{sub}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-2 text-center">
      <p className="text-slate-500 text-[10px]">{label}</p>
      <p className="text-slate-200 text-xs font-medium mt-0.5">{value}</p>
    </div>
  )
}
