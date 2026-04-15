// ─── Tipos y funciones puras del módulo Objetivos ────────────────────────────
// NO incluye 'use server' — importable desde componentes cliente y servidor.

export type ScopeType      = 'all' | 'category' | 'family' | 'product'
export type MetricType     = 'revenue' | 'margin' | 'margin_pct' | 'units' | 'new_clients'
export type PeriodType     = 'monthly' | 'quarterly' | 'annual' | 'custom'
export type CommissionType = 'none' | 'bonus' | 'percentage' | 'tiered'
export type AppliesTo      = 'all' | 'selected'

export interface CommissionTier {
  threshold_pct: number   // % del objetivo (ej: 80, 100, 120)
  type:          'bonus' | 'percentage'
  value:         number   // € fijo o % según type
}

export interface ObjectiveInput {
  name:             string
  description?:     string
  scope_type:       ScopeType
  scope_values:     string[]
  metric:           MetricType
  target_value:     number
  period_type:      PeriodType
  start_date:       string   // ISO date YYYY-MM-DD
  end_date:         string
  commission_type:  CommissionType
  commission_config: {
    bonus?:      number
    percentage?: number
    tiers?:      CommissionTier[]
  }
  applies_to:    AppliesTo
  comercial_ids: string[]
}

export interface Objective extends ObjectiveInput {
  id:         string
  client_id:  string
  active:     boolean
  created_at: string
  updated_at: string
}

export interface ObjectiveProgress {
  objective:            Objective
  current_value:        number
  pct_completed:        number   // 0-100+
  remaining:            number
  on_track:             boolean  // ritmo actual vs necesario
  days_remaining:       number
  days_total:           number
  pct_period_elapsed:   number
  estimated_commission: number
}

// ─── Comisión estimada ────────────────────────────────────────────────────────

function calcEstimatedCommission(obj: Objective, pctCompleted: number): number {
  if (obj.commission_type === 'none') return 0

  if (obj.commission_type === 'bonus') {
    return pctCompleted >= 100 ? (obj.commission_config.bonus ?? 0) : 0
  }

  if (obj.commission_type === 'percentage') {
    const pct = obj.commission_config.percentage ?? 0
    return (obj.target_value * (pctCompleted / 100)) * pct
  }

  if (obj.commission_type === 'tiered') {
    const tiers = [...(obj.commission_config.tiers ?? [])]
      .sort((a, b) => a.threshold_pct - b.threshold_pct)
    const reached = [...tiers].reverse().find(t => pctCompleted >= t.threshold_pct)
    if (!reached) return 0
    if (reached.type === 'bonus') return reached.value
    return obj.target_value * (pctCompleted / 100) * reached.value
  }

  return 0
}

// ─── Progreso del objetivo ────────────────────────────────────────────────────

/**
 * Calcula el progreso de un objetivo dado el valor actual.
 * El valor actual viene de los KPIs reales del cliente.
 */
export function calcObjectiveProgress(
  objective: Objective,
  currentValue: number
): ObjectiveProgress {
  const pctCompleted  = objective.target_value > 0
    ? (currentValue / objective.target_value) * 100
    : 0

  const remaining     = Math.max(0, objective.target_value - currentValue)

  const today         = new Date()
  const start         = new Date(objective.start_date)
  const end           = new Date(objective.end_date)
  const daysTotal     = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
  const daysElapsed   = Math.max(0, Math.ceil((today.getTime() - start.getTime()) / 86400000))
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000))
  const pctPeriod     = Math.min(100, (daysElapsed / daysTotal) * 100)

  // Ritmo: si hemos consumido X% del tiempo, deberíamos tener X% del objetivo
  const onTrack       = pctCompleted >= pctPeriod * 0.9  // margen del 10%

  const estimatedComm = calcEstimatedCommission(objective, pctCompleted)

  return {
    objective,
    current_value:        currentValue,
    pct_completed:        pctCompleted,
    remaining,
    on_track:             onTrack,
    days_remaining:       daysRemaining,
    days_total:           daysTotal,
    pct_period_elapsed:   pctPeriod,
    estimated_commission: estimatedComm,
  }
}

// ─── Extracción del valor actual desde KPIs ───────────────────────────────────

/**
 * Extrae el valor actual de los KPIs según la métrica y scope del objetivo.
 */
export function extractCurrentValue(
  objective: Objective,
  kpisExtendedData: Record<string, unknown> | null
): number {
  if (!kpisExtendedData) return 0

  const categorias = kpisExtendedData.categorias as Record<string, {
    ventas: number; margen: number; margen_pct: number
  }> | undefined

  const metricKey = (cat: Record<string, number | string>) => {
    switch (objective.metric) {
      case 'revenue':    return Number(cat.ventas     ?? 0)
      case 'margin':     return Number(cat.margen     ?? 0)
      case 'margin_pct': return Number(cat.margen_pct ?? 0)
      default:           return 0
    }
  }

  if (objective.scope_type === 'all') {
    if (objective.metric === 'revenue')     return Number(kpisExtendedData.total_ventas   ?? 0)
    if (objective.metric === 'margin')      return Number(kpisExtendedData.total_margen   ?? 0)
    if (objective.metric === 'new_clients') return Number(kpisExtendedData.clientes_activos ?? 0)
    return 0
  }

  if (!categorias) return 0

  if (objective.scope_type === 'category') {
    return objective.scope_values.reduce((sum, cat) => {
      const data = categorias[cat]
      return sum + (data ? metricKey(data as unknown as Record<string, number | string>) : 0)
    }, 0)
  }

  return 0
}
