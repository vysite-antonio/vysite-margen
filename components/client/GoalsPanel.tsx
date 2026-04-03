'use client'

import { useState, useTransition } from 'react'
import type { ClientGoals, KPIs } from '@/types'
import { saveGoals } from '@/lib/actions/goals'

interface Props {
  goals: ClientGoals | undefined
  kpis: KPIs | null
}

// Devuelve color + label en función de distancia al objetivo
function getGoalStatus(actual: number, target: number, higherIsBetter = true) {
  const ratio = actual / target
  const ok = higherIsBetter ? ratio >= 1 : ratio <= 1
  const warn = higherIsBetter ? ratio >= 0.85 : ratio <= 1.15

  if (ok)   return { color: 'emerald', label: 'En objetivo' }
  if (warn) return { color: 'amber',   label: 'Cerca del objetivo' }
  return      { color: 'red',          label: 'Por debajo del objetivo' }
}

function GoalRow({
  label,
  actual,
  target,
  unit = '€',
  higherIsBetter = true,
  formatter = (v: number) => v.toLocaleString('es-ES'),
}: {
  label: string
  actual: number
  target: number
  unit?: string
  higherIsBetter?: boolean
  formatter?: (v: number) => string
}) {
  if (!target) return null

  const { color, label: statusLabel } = getGoalStatus(actual, target, higherIsBetter)
  const progress = higherIsBetter
    ? Math.min(100, (actual / target) * 100)
    : Math.min(100, (target / actual) * 100)

  const colorMap = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
    amber:   { bar: 'bg-amber-500',   text: 'text-amber-400',   badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400'   },
    red:     { bar: 'bg-red-500',     text: 'text-red-400',     badge: 'bg-red-500/10 border-red-500/30 text-red-400'         },
  }

  const c = colorMap[color as keyof typeof colorMap]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-sm">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${c.badge}`}>{statusLabel}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-sm font-semibold tabular-nums ${c.text} min-w-[70px] text-right`}>
          {formatter(actual)}{unit}
        </span>
        <span className="text-slate-600 text-xs tabular-nums min-w-[60px] text-right">
          /{formatter(target)}{unit}
        </span>
      </div>
    </div>
  )
}

export default function GoalsPanel({ goals, kpis }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ClientGoals>({
    margen_objetivo_pct:    goals?.margen_objetivo_pct    ?? undefined,
    facturacion_objetivo_mes: goals?.facturacion_objetivo_mes ?? undefined,
    potencial_minimo_mes:   goals?.potencial_minimo_mes   ?? undefined,
    notas: goals?.notas ?? '',
  })
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasGoals = !!(goals?.margen_objetivo_pct || goals?.facturacion_objetivo_mes || goals?.potencial_minimo_mes)

  const handleSave = () => {
    startTransition(async () => {
      const { error } = await saveGoals(form)
      if (!error) {
        setSaved(true)
        setEditing(false)
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  const numField = (key: keyof ClientGoals, label: string, unit: string, placeholder: string) => (
    <div>
      <label className="block text-slate-400 text-xs mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={form[key] ?? ''}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : undefined }))}
          placeholder={placeholder}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm pr-10 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-white font-semibold text-sm">Objetivos comerciales</h2>
          <p className="text-slate-500 text-xs mt-0.5">Seguimiento de metas y alertas de desviación</p>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors"
        >
          {editing ? 'Cancelar' : (hasGoals ? 'Editar' : '+ Añadir objetivos')}
        </button>
      </div>

      {/* ── Formulario de edición ── */}
      {editing && (
        <div className="space-y-4 mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-xs">Define tus metas. Se mostrarán alertas cuando los resultados se desvíen.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {numField('margen_objetivo_pct',    'Margen objetivo',         '%',  'ej. 28')}
            {numField('facturacion_objetivo_mes','Facturación objetivo/mes','€', 'ej. 50000')}
            {numField('potencial_minimo_mes',   'Potencial mínimo/mes',    '€',  'ej. 5000')}
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Notas (opcional)</label>
            <textarea
              rows={2}
              value={form.notas ?? ''}
              onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))}
              placeholder="Compromisos, contexto del periodo…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar objetivos'}
          </button>
          {saved && <span className="text-emerald-400 text-xs ml-3">✓ Guardado</span>}
        </div>
      )}

      {/* ── Vista de progreso ── */}
      {hasGoals && kpis && !editing && (
        <div className="space-y-4">
          <GoalRow
            label="Margen global"
            actual={kpis.margen_porcentaje}
            target={goals?.margen_objetivo_pct ?? 0}
            unit="%"
            formatter={v => v.toFixed(1)}
          />
          <GoalRow
            label="Facturación mensual"
            actual={kpis.facturacion_total}
            target={goals?.facturacion_objetivo_mes ?? 0}
            unit="€"
          />
          <GoalRow
            label="Potencial pendiente/mes"
            actual={kpis.potencial_mensual}
            target={goals?.potencial_minimo_mes ?? 0}
            unit="€"
          />
          {goals?.notas && (
            <p className="text-slate-500 text-xs pt-2 border-t border-slate-800 italic">
              {goals.notas}
            </p>
          )}
        </div>
      )}

      {/* ── Estado vacío ── */}
      {!hasGoals && !editing && (
        <div className="text-center py-6">
          <p className="text-slate-500 text-sm">Sin objetivos configurados</p>
          <p className="text-slate-600 text-xs mt-1">
            Define metas de margen y facturación para ver alertas de seguimiento.
          </p>
        </div>
      )}
    </div>
  )
}
