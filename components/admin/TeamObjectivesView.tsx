'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ObjectiveWizard from '@/components/admin/ObjectiveWizard'
import { deleteObjective } from '@/lib/actions/objectives'
import { calcObjectiveProgress } from '@/lib/utils/objectives'
import type { Objective, ObjectiveProgress } from '@/lib/utils/objectives'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Comercial {
  id:    string
  name:  string
  email: string
}

interface Props {
  clientId:    string
  objectives:  Objective[]
  comerciales: Comercial[]
  kpisData:    Record<string, unknown> | null  // extended_data de KPIs
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}
function pct(n: number) {
  return Math.round(n) + '%'
}
function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
}

const METRIC_LABELS: Record<string, string> = {
  revenue: 'Facturación', margin: 'Margen', margin_pct: 'Margen %',
  units: 'Unidades', new_clients: 'Clientes nuevos',
}
const METRIC_UNITS: Record<string, string> = {
  revenue: '€', margin: '€', margin_pct: '%', units: 'ud', new_clients: 'cli',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TeamObjectivesView({ clientId, objectives, comerciales, kpisData }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showWizard,  setShowWizard]  = useState(false)
  const [editingObj,  setEditingObj]  = useState<Objective | null>(null)
  const [detailCom,   setDetailCom]   = useState<string | null>(null)   // id del comercial seleccionado
  const [tab, setTab] = useState<'active' | 'all'>('active')

  const today = new Date().toISOString().split('T')[0]

  const activeObjs = objectives.filter(o => o.active && o.start_date <= today && o.end_date >= today)
  const allObjs    = objectives.filter(o => o.active)

  const displayObjs = tab === 'active' ? activeObjs : allObjs

  // Calcular progreso de cada objetivo (valor actual = 0 si no hay KPIs reales)
  function getProgress(obj: Objective): ObjectiveProgress {
    // Sin integración KPI real aún — usar 0 como placeholder hasta que los datos lleguen via sync
    const current = 0
    return calcObjectiveProgress(obj, current)
  }

  function objAppliesTo(obj: Objective, comId: string) {
    return obj.applies_to === 'all' || obj.comercial_ids.includes(comId)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteObjective(id)
      router.refresh()
    })
  }

  // ── Vista detalle comercial ───────────────────────────────────────────────
  if (detailCom) {
    const com      = comerciales.find(c => c.id === detailCom)
    const myObjs   = objectives.filter(o => o.active && objAppliesTo(o, detailCom))
    const myActive = myObjs.filter(o => o.start_date <= today && o.end_date >= today)

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setDetailCom(null)}
            className="text-slate-400 hover:text-white text-sm transition-colors">
            ← Equipo
          </button>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-medium">{com?.name}</span>
          <span className="text-slate-500 text-xs">{com?.email}</span>
        </div>

        {myActive.length === 0 ? (
          <EmptyState
            emoji="🎯"
            title="Sin objetivos activos"
            desc="Este comercial no tiene objetivos para el período actual."
          />
        ) : (
          <div className="space-y-4">
            {myActive.map(obj => {
              const prog = getProgress(obj)
              return <ObjectiveDetailCard key={obj.id} progress={prog} onEdit={() => { setEditingObj(obj); setDetailCom(null); setShowWizard(true) }} onDelete={() => handleDelete(obj.id)} isPending={isPending} />
            })}
          </div>
        )}

        {myObjs.filter(o => o.end_date < today).length > 0 && (
          <div>
            <h4 className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-3">Objetivos pasados</h4>
            <div className="space-y-2">
              {myObjs.filter(o => o.end_date < today).map(obj => {
                const prog = getProgress(obj)
                return (
                  <div key={obj.id} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 opacity-60">
                    <span className="text-slate-400 text-xs flex-1">{obj.name}</span>
                    <span className="text-slate-500 text-xs">{fmtDate(obj.start_date)} – {fmtDate(obj.end_date)}</span>
                    <span className={`text-xs font-medium ${prog.pct_completed >= 100 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pct(prog.pct_completed)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vista principal: equipo ───────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Wizard modal */}
      {showWizard && (
        <ObjectiveWizard
          clientId={clientId}
          comerciales={comerciales}
          editing={editingObj ?? undefined}
          onClose={() => { setShowWizard(false); setEditingObj(null) }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit">
          {(['active','all'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${tab === t ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {t === 'active' ? `Activos (${activeObjs.length})` : `Todos (${allObjs.length})`}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditingObj(null); setShowWizard(true) }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
          <span>+</span>
          <span>Nuevo objetivo</span>
        </button>
      </div>

      {/* Vista de equipo: tabla de comerciales × objetivos */}
      {comerciales.length > 0 && displayObjs.length > 0 ? (
        <div className="space-y-3">
          {/* Cabecera global de objetivos activos */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayObjs.map(obj => (
              <ObjectiveSummaryCard
                key={obj.id}
                objective={obj}
                comerciales={comerciales}
                onEdit={() => { setEditingObj(obj); setShowWizard(true) }}
                onDelete={() => handleDelete(obj.id)}
                isPending={isPending}
              />
            ))}
          </div>

          {/* Tabla de comerciales con su progreso */}
          {activeObjs.length > 0 && comerciales.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <h4 className="text-white text-sm font-medium">Seguimiento por comercial</h4>
                <p className="text-slate-500 text-xs mt-0.5">Haz clic en un comercial para ver su detalle</p>
              </div>
              <div className="divide-y divide-slate-800/60">
                {comerciales.map(com => {
                  const comObjs = activeObjs.filter(o => objAppliesTo(o, com.id))
                  const progressList = comObjs.map(o => getProgress(o))
                  const avgPct = progressList.length > 0
                    ? progressList.reduce((a, p) => a + p.pct_completed, 0) / progressList.length
                    : 0
                  const allOnTrack = progressList.every(p => p.on_track)

                  return (
                    <button
                      key={com.id}
                      onClick={() => setDetailCom(com.id)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-800/40 transition-colors text-left"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                        <span className="text-slate-300 text-xs font-bold">
                          {com.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                        </span>
                      </div>

                      {/* Nombre */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{com.name}</p>
                        <p className="text-slate-500 text-xs">{comObjs.length} objetivo{comObjs.length !== 1 ? 's' : ''} activo{comObjs.length !== 1 ? 's' : ''}</p>
                      </div>

                      {/* Progreso mini */}
                      {comObjs.length > 0 ? (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-24">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-xs font-medium ${avgPct >= 100 ? 'text-emerald-400' : avgPct >= 80 ? 'text-amber-400' : 'text-slate-400'}`}>
                                {pct(avgPct)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${avgPct >= 100 ? 'bg-emerald-500' : avgPct >= 80 ? 'bg-amber-500' : 'bg-slate-500'}`}
                                style={{ width: `${Math.min(100, avgPct)}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-xs ${allOnTrack ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {allOnTrack ? '✓ al ritmo' : '⚠ retrasado'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs shrink-0">Sin objetivos</span>
                      )}

                      <span className="text-slate-600 text-xs shrink-0">→</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          emoji="🎯"
          title={displayObjs.length === 0 ? 'Sin objetivos configurados' : 'Sin comerciales asignados'}
          desc={displayObjs.length === 0
            ? 'Crea el primer objetivo para tu equipo comercial.'
            : 'Asigna comerciales a este cliente para hacer seguimiento.'}
        />
      )}
    </div>
  )
}

// ─── Tarjeta resumen de objetivo ──────────────────────────────────────────────

function ObjectiveSummaryCard({ objective: obj, comerciales, onEdit, onDelete, isPending }: {
  objective:   Objective
  comerciales: { id: string; name: string }[]
  onEdit:      () => void
  onDelete:    () => void
  isPending:   boolean
}) {
  const [showActions, setShowActions] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const isPast    = obj.end_date < today
  const isFuture  = obj.start_date > today

  const assignedCount = obj.applies_to === 'all'
    ? comerciales.length
    : obj.comercial_ids.length

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 space-y-3 relative
      ${isPast ? 'border-slate-800 opacity-60' : isFuture ? 'border-slate-700 border-dashed' : 'border-slate-800'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Actions */}
      {showActions && (
        <div className="absolute top-3 right-3 flex gap-1">
          <button onClick={onEdit} className="text-slate-500 hover:text-white text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">✏️</button>
          <button onClick={onDelete} disabled={isPending} className="text-slate-500 hover:text-red-400 text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-40">🗑️</button>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start gap-2 pr-12">
          <p className="text-white text-sm font-medium leading-snug">{obj.name}</p>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-slate-500 text-xs">{fmtDate(obj.start_date)} → {fmtDate(obj.end_date)}</span>
          {isPast    && <Badge color="slate">Finalizado</Badge>}
          {isFuture  && <Badge color="blue">Próximo</Badge>}
          {!isPast && !isFuture && <Badge color="emerald">En curso</Badge>}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs">{METRIC_LABELS[obj.metric] ?? obj.metric}</p>
          <p className="text-white text-base font-semibold">
            {obj.target_value.toLocaleString('es-ES')} {METRIC_UNITS[obj.metric] ?? ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-xs">Alcance</p>
          <p className="text-slate-300 text-xs">
            {obj.scope_type === 'all' ? 'Toda la facturación' :
             obj.scope_values.length > 0 ? obj.scope_values.slice(0,2).join(', ') + (obj.scope_values.length > 2 ? '…' : '') : obj.scope_type}
          </p>
        </div>
      </div>

      {/* Comisión + asignación */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <span className="text-slate-500 text-xs">
          {obj.commission_type === 'none'       ? 'Sin comisión' :
           obj.commission_type === 'bonus'      ? `Bonus ${eur(obj.commission_config.bonus ?? 0)}` :
           obj.commission_type === 'percentage' ? `${((obj.commission_config.percentage ?? 0)*100).toFixed(1)}% comisión` :
           `Escalonado (${obj.commission_config.tiers?.length ?? 0} tramos)`}
        </span>
        <span className="text-slate-600 text-xs">
          👥 {assignedCount} comercial{assignedCount !== 1 ? 'es' : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Tarjeta detalle de progreso (vista individual comercial) ─────────────────

function ObjectiveDetailCard({ progress: p, onEdit, onDelete, isPending }: {
  progress:  ObjectiveProgress
  onEdit:    () => void
  onDelete:  () => void
  isPending: boolean
}) {
  const obj    = p.objective
  const pctCap = Math.min(100, p.pct_completed)
  const barColor = pctCap >= 100 ? 'bg-emerald-500' : pctCap >= 80 ? 'bg-amber-500' : pctCap >= 50 ? 'bg-blue-500' : 'bg-slate-500'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-white font-semibold text-sm">{obj.name}</h4>
          <p className="text-slate-500 text-xs mt-0.5">
            {fmtDate(obj.start_date)} → {fmtDate(obj.end_date)}
            {' · '}{p.days_remaining} día{p.days_remaining !== 1 ? 's' : ''} restante{p.days_remaining !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="text-slate-500 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors">✏️</button>
          <button onClick={onDelete} disabled={isPending} className="text-slate-500 hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors">🗑️</button>
        </div>
      </div>

      {/* Progreso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">
            {p.current_value.toLocaleString('es-ES')} {METRIC_UNITS[obj.metric]} de {obj.target_value.toLocaleString('es-ES')} {METRIC_UNITS[obj.metric]}
          </span>
          <span className={`text-sm font-bold ${pctCap >= 100 ? 'text-emerald-400' : pctCap >= 80 ? 'text-amber-400' : 'text-slate-300'}`}>
            {pct(p.pct_completed)}
          </span>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pctCap}%` }} />
        </div>
        {p.remaining > 0 && (
          <p className="text-slate-500 text-xs">
            Faltan <span className="text-white">{p.remaining.toLocaleString('es-ES')} {METRIC_UNITS[obj.metric]}</span> para alcanzar el objetivo
          </p>
        )}
      </div>

      {/* Ritmo */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${p.on_track ? 'text-emerald-400' : 'text-amber-400'}`}>
          {p.on_track ? '✓ Al ritmo adecuado' : '⚠ Por debajo del ritmo necesario'}
        </span>
        <span className="text-slate-600 text-xs">
          ({pct(p.pct_period_elapsed)} del período consumido)
        </span>
      </div>

      {/* Comisión en juego */}
      {obj.commission_type !== 'none' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-slate-400 text-xs">Comisión estimada al ritmo actual</span>
          <span className="text-emerald-400 text-sm font-semibold">{eur(p.estimated_commission)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Helpers visuales ─────────────────────────────────────────────────────────

function Badge({ color, children }: { color: 'emerald'|'amber'|'blue'|'slate'|'red'; children: React.ReactNode }) {
  const styles = {
    emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50',
    amber:   'bg-amber-950/60 text-amber-400 border-amber-800/50',
    blue:    'bg-blue-950/60 text-blue-400 border-blue-800/50',
    slate:   'bg-slate-800 text-slate-500 border-slate-700',
    red:     'bg-red-950/60 text-red-400 border-red-800/50',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[color]}`}>
      {children}
    </span>
  )
}

function EmptyState({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
      <p className="text-slate-500 text-xs max-w-xs mx-auto">{desc}</p>
    </div>
  )
}
