'use client'

import { useState, useMemo, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { calcCommission } from '@/lib/utils/commission'
import type { IncentiveRule, CommissionConfig, KPIs } from '@/types'

// ─── Colores por categoría ────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { bg: string; border: string; text: string; bar: string; hex: string }> = {
  Limpieza:     { bg: 'bg-cyan-950/40',    border: 'border-cyan-800/50',   text: 'text-cyan-400',    bar: 'bg-cyan-500',    hex: '#06b6d4' },
  Droguería:    { bg: 'bg-violet-950/40',  border: 'border-violet-800/50', text: 'text-violet-400',  bar: 'bg-violet-500',  hex: '#8b5cf6' },
  Alimentación: { bg: 'bg-emerald-950/40', border: 'border-emerald-800/50',text: 'text-emerald-400', bar: 'bg-emerald-500', hex: '#10b981' },
  Bebidas:      { bg: 'bg-blue-950/40',    border: 'border-blue-800/50',   text: 'text-blue-400',    bar: 'bg-blue-500',    hex: '#3b82f6' },
  Menaje:       { bg: 'bg-amber-950/40',   border: 'border-amber-800/50',  text: 'text-amber-400',   bar: 'bg-amber-500',   hex: '#f59e0b' },
  Fresco:       { bg: 'bg-rose-950/40',    border: 'border-rose-800/50',   text: 'text-rose-400',    bar: 'bg-rose-500',    hex: '#f43f5e' },
  Otros:        { bg: 'bg-slate-800/60',   border: 'border-slate-700',     text: 'text-slate-400',   bar: 'bg-slate-500',   hex: '#64748b' },
}

const DEFAULT_COLOR = CAT_COLORS.Otros
const TIER_COLORS: Record<string, string> = {
  bronce: 'text-orange-400',
  plata:  'text-slate-300',
  oro:    'text-yellow-400',
}
const TIER_BG: Record<string, string> = {
  bronce: 'bg-orange-950/50 border-orange-800/50',
  plata:  'bg-slate-800/80 border-slate-600/50',
  oro:    'bg-yellow-950/50 border-yellow-800/50',
}

const ALL_CATEGORIES = ['Limpieza', 'Droguería', 'Alimentación', 'Bebidas', 'Menaje', 'Fresco']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

function pct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string
  kpis: KPIs | null
  rules: IncentiveRule[]
  commissionConfig: CommissionConfig | null
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function IncentiveSimulator({ kpis, rules, commissionConfig }: Props) {
  // Ventas reales del mes por categoría (del ciclo más reciente)
  const realSales = useMemo<Record<string, number>>(() => {
    const ext = kpis?.extended_data
    if (!ext?.margen_por_categoria?.length) {
      // Demo data si no hay KPIs reales
      return { Limpieza: 3200, Droguería: 1800, Alimentación: 5500, Bebidas: 4100, Menaje: 900, Fresco: 2200 }
    }
    const map: Record<string, number> = {}
    for (const row of ext.margen_por_categoria) {
      map[row.categoria] = row.facturacion
    }
    return map
  }, [kpis])

  // Categorías presentes (de reglas o de ventas reales)
  const categories = useMemo(() => {
    const cats = new Set([
      ...ALL_CATEGORIES,
      ...Object.keys(realSales),
      ...rules.map(r => r.category),
    ])
    return [...cats].filter(c => (realSales[c] ?? 0) > 0 || rules.some(r => r.category === c))
  }, [realSales, rules])

  // Estado de sliders: simulación
  const [simSales, setSimSales] = useState<Record<string, number>>(() => ({ ...realSales }))
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({})

  const updateSim = useCallback((cat: string, val: number) => {
    setSimSales(prev => ({ ...prev, [cat]: val }))
    // Detectar si se alcanzó un umbral nuevo → efecto desbloqueado
    const catRules = rules.filter(r => r.category === cat)
    const newlyUnlocked = catRules.some(r => val >= r.threshold_amount && realSales[cat] < r.threshold_amount)
    if (newlyUnlocked) {
      setUnlocked(prev => ({ ...prev, [cat]: true }))
      setTimeout(() => setUnlocked(prev => ({ ...prev, [cat]: false })), 1800)
    }
  }, [rules, realSales])

  // Cálculo comisiones
  const realCommission  = useMemo(() => calcCommission(realSales, commissionConfig, rules), [realSales, commissionConfig, rules])
  const simCommission   = useMemo(() => calcCommission(simSales, commissionConfig, rules), [simSales, commissionConfig, rules])
  const delta           = simCommission.total - realCommission.total

  // Ranking de mejores acciones: €/esfuerzo para llegar al próximo tier
  const bestActions = useMemo(() => {
    return categories
      .flatMap(cat => {
        const current = simSales[cat] ?? 0
        const catRules = rules
          .filter(r => r.category === cat)
          .sort((a, b) => a.threshold_amount - b.threshold_amount)

        return catRules
          .filter(r => current < r.threshold_amount)
          .slice(0, 1) // solo el próximo tier
          .map(r => {
            const effort = r.threshold_amount - current
            const testSales = { ...simSales, [cat]: r.threshold_amount }
            const testCommission = calcCommission(testSales, commissionConfig, rules)
            const gain = testCommission.total - simCommission.total
            return {
              cat,
              tier: r.tier_name,
              effort,
              gain,
              ratio: effort > 0 ? gain / effort : 0,
              type: r.incentive_type,
              value: r.incentive_value,
            }
          })
      })
      .filter(a => a.gain > 0)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 4)
  }, [categories, simSales, rules, commissionConfig, simCommission])

  // Reset simulación
  const reset = () => setSimSales({ ...realSales })

  const hasRules = rules.length > 0
  const hasConfig = !!commissionConfig
  const isDemo = !kpis?.extended_data?.margen_por_categoria?.length

  return (
    <div className="space-y-5">

      {/* ── Banner demo o aviso sin configurar ─────────────────────────────── */}
      {(isDemo || !hasConfig) && (
        <div className="flex items-start gap-3 bg-violet-950/40 border border-violet-800/50 rounded-xl px-4 py-3">
          <span className="text-lg shrink-0">{isDemo ? '🎭' : '⚙️'}</span>
          <div>
            <p className="text-violet-300 text-xs font-medium">
              {isDemo ? 'Modo demo — datos de ejemplo' : 'Configuración pendiente'}
            </p>
            <p className="text-violet-500 text-xs">
              {isDemo
                ? 'Cuando tu administrador procese un ciclo, el simulador usará tus ventas reales del mes.'
                : 'Pide a tu administrador que configure las reglas de incentivos y la comisión base.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Panel superior: comisión actual vs simulada ─────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-500 text-xs mb-1">Comisión actual</p>
          <p className="text-2xl font-bold text-white tabular-nums">{eur(realCommission.total)}</p>
          <p className="text-slate-600 text-xs mt-1">
            Base: {eur(realCommission.base)}
            {realCommission.multiplier > 1 && ` × ${realCommission.multiplier}`}
          </p>
        </div>
        <div className={`rounded-2xl p-4 border transition-all duration-300 ${
          delta > 0
            ? 'bg-emerald-950/50 border-emerald-800/60'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <p className="text-slate-500 text-xs mb-1">Con tu simulación</p>
          <p className={`text-2xl font-bold tabular-nums ${delta > 0 ? 'text-emerald-400' : 'text-white'}`}>
            {eur(simCommission.total)}
          </p>
          <p className={`text-xs mt-1 font-semibold tabular-nums ${
            delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-400' : 'text-slate-600'
          }`}>
            {delta > 0 ? '+' : ''}{eur(delta)} vs actual
          </p>
        </div>
      </div>

      {/* ── Bonificaciones activas ─────────────────────────────────────────── */}
      {simCommission.bonuses.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-xs font-semibold mb-3">Incentivos activos</p>
          <div className="flex flex-wrap gap-2">
            {simCommission.bonuses.map((b, i) => (
              <span key={i} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${TIER_BG[b.tier]}`}>
                <span>{b.tier === 'oro' ? '🥇' : b.tier === 'plata' ? '🥈' : '🥉'}</span>
                <span className={TIER_COLORS[b.tier]}>{b.label}</span>
                {b.amount > 0 && <span className="text-slate-400">+{eur(b.amount)}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Sliders por categoría ──────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-300 text-sm font-semibold">Simulador de ventas</p>
          <button
            onClick={reset}
            className="text-slate-500 hover:text-slate-300 text-xs border border-slate-700 hover:border-slate-600 px-2.5 py-1 rounded-lg transition-colors"
          >
            ↩ Resetear
          </button>
        </div>
        <div className="space-y-5">
          {categories.map(cat => {
            const color   = CAT_COLORS[cat] ?? DEFAULT_COLOR
            const current = simSales[cat] ?? 0
            const catRules = rules
              .filter(r => r.category === cat)
              .sort((a, b) => a.threshold_amount - b.threshold_amount)

            const maxVal = catRules.length
              ? Math.max(...catRules.map(r => r.threshold_amount)) * 1.3
              : Math.max((realSales[cat] ?? 1000) * 2, 5000)

            const nextRule = catRules.find(r => current < r.threshold_amount)
            const reachedRules = catRules.filter(r => current >= r.threshold_amount)
            const topReached = reachedRules[reachedRules.length - 1]

            return (
              <div key={cat} className={`rounded-xl border p-3 transition-all duration-500 ${
                unlocked[cat]
                  ? 'border-emerald-500/60 bg-emerald-950/30 shadow-lg shadow-emerald-900/20'
                  : `${color.border} ${color.bg}`
              }`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${color.text}`}>{cat}</span>
                    {topReached && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TIER_BG[topReached.tier_name]}`}>
                        {topReached.tier_name === 'oro' ? '🥇' : topReached.tier_name === 'plata' ? '🥈' : '🥉'} {topReached.tier_name}
                      </span>
                    )}
                    {unlocked[cat] && (
                      <span className="text-emerald-400 text-xs font-bold animate-pulse">✨ Desbloqueado</span>
                    )}
                  </div>
                  <span className="text-white text-sm font-bold tabular-nums">{eur(current)}</span>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={Math.round(maxVal)}
                  step={100}
                  value={Math.round(current)}
                  onChange={e => updateSim(cat, Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-cyan-500 bg-slate-700"
                />

                {/* Marcas de umbrales */}
                {catRules.length > 0 && (
                  <div className="flex justify-between mt-1">
                    {catRules.map(r => {
                      const pos = Math.min((r.threshold_amount / maxVal) * 100, 98)
                      const reached = current >= r.threshold_amount
                      return (
                        <div
                          key={r.id}
                          className="flex flex-col items-center"
                          style={{ marginLeft: `${pos}%`, transform: 'translateX(-50%)', position: 'absolute' }}
                        >
                          <div className={`w-1 h-1 rounded-full ${reached ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Próximo umbral */}
                {nextRule && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                    <span className="text-slate-500 text-[10px]">
                      Siguiente: {nextRule.tier_name} ({eur(nextRule.threshold_amount)})
                    </span>
                    <span className={`text-[10px] font-semibold ${color.text}`}>
                      te faltan {eur(nextRule.threshold_amount - current)}
                    </span>
                  </div>
                )}

                {/* Barra de progreso hacia próximo umbral */}
                {nextRule && (
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${color.bar}`}
                      style={{ width: `${Math.min((current / nextRule.threshold_amount) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Gráfica comparativa real vs simulado ───────────────────────────── */}
      {categories.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-300 text-xs font-semibold mb-4">Ventas reales vs simuladas</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={categories.map(cat => ({
              cat: cat.slice(0, 4),
              real: Math.round(realSales[cat] ?? 0),
              sim:  Math.round(simSales[cat] ?? 0),
            }))} barGap={2} barSize={18}>
              <XAxis dataKey="cat" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown, name: unknown) => [eur(Number(v ?? 0)), name === 'real' ? 'Actual' : 'Simulado']}
              />
              <Bar dataKey="real" radius={[4, 4, 0, 0]} fill="#334155" />
              <Bar dataKey="sim" radius={[4, 4, 0, 0]}>
                {categories.map((cat, i) => (
                  <Cell key={i} fill={(CAT_COLORS[cat] ?? DEFAULT_COLOR).hex} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Mejores acciones: ranking €/esfuerzo ──────────────────────────── */}
      {bestActions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-300 text-xs font-semibold mb-3">💡 Mejores acciones</p>
          <div className="space-y-2.5">
            {bestActions.map((a, i) => {
              const color = CAT_COLORS[a.cat] ?? DEFAULT_COLOR
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className={`text-lg shrink-0 mt-0.5 ${TIER_COLORS[a.tier]}`}>
                    {a.tier === 'oro' ? '🥇' : a.tier === 'plata' ? '🥈' : '🥉'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs leading-snug">
                      Si vendes{' '}
                      <span className={`font-semibold ${color.text}`}>{eur(a.effort)} más de {a.cat}</span>
                      {' → '}
                      <span className="text-emerald-400 font-bold">+{eur(a.gain)}</span> de comisión
                    </p>
                    <p className="text-slate-600 text-[10px] mt-0.5">
                      {eur(Math.round(a.ratio))} por cada € de esfuerzo extra
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Desglose comisión simulada ──────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <p className="text-slate-400 text-xs font-semibold mb-3">Desglose comisión proyectada</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Comisión base</span>
            <span className="text-white font-medium tabular-nums">{eur(simCommission.base)}</span>
          </div>
          {simCommission.multiplier > 1 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Multiplicador global</span>
              <span className="text-violet-400 font-medium">×{simCommission.multiplier}</span>
            </div>
          )}
          {simCommission.bonuses.filter(b => b.amount > 0).map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{b.label}</span>
              <span className="text-emerald-400 font-medium tabular-nums">+{eur(b.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-slate-800">
            <span className="text-white">Total proyectado</span>
            <span className="text-emerald-400 tabular-nums">{eur(simCommission.total)}</span>
          </div>
        </div>
      </div>

      {/* ── Base: total ventas simuladas ──────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <span>Total ventas simuladas: {eur(Object.values(simSales).reduce((a, b) => a + b, 0))}</span>
        <span>|</span>
        <span>Real: {eur(Object.values(realSales).reduce((a, b) => a + b, 0))}</span>
      </div>

    </div>
  )
}
