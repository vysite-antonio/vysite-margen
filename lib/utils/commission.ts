import type { IncentiveRule, CommissionConfig, CommissionResult } from '@/types'

/**
 * Motor de cálculo de comisión — función pura, sin side-effects.
 * Importable desde cliente y servidor sin necesitar 'use server'.
 */
export function calcCommission(
  salesByCategory: Record<string, number>,
  config: CommissionConfig | null,
  rules: IncentiveRule[]
): CommissionResult {
  const totalSales = Object.values(salesByCategory).reduce((a, b) => a + b, 0)

  // 1. Comisión base
  let base = 0
  if (config) {
    if (config.base_type === 'flat') {
      base = totalSales * config.base_percentage
    } else {
      // Tiered: aplicar tramos escalonados
      const sorted = [...config.tiers].sort((a, b) => (a.up_to ?? Infinity) - (b.up_to ?? Infinity))
      let remaining = totalSales
      let prev = 0
      for (const tier of sorted) {
        const cap = tier.up_to ?? Infinity
        const chunk = Math.min(remaining, cap - prev)
        base += chunk * tier.percentage
        remaining -= chunk
        prev = cap
        if (remaining <= 0) break
      }
    }
  }

  // 2. Bonificaciones por categoría
  const bonuses: CommissionResult['bonuses'] = []
  let multiplier = 1

  // Agrupar reglas por categoría, ordenadas por threshold
  const byCategory: Record<string, IncentiveRule[]> = {}
  for (const rule of rules) {
    if (!byCategory[rule.category]) byCategory[rule.category] = []
    byCategory[rule.category].push(rule)
  }

  for (const [cat, catRules] of Object.entries(byCategory)) {
    const sales = salesByCategory[cat] ?? 0
    // Aplicar el tier más alto alcanzado
    const reached = [...catRules]
      .sort((a, b) => b.threshold_amount - a.threshold_amount)
      .find(r => sales >= r.threshold_amount)

    if (reached) {
      if (reached.incentive_type === 'bonus') {
        bonuses.push({
          category: cat,
          tier: reached.tier_name,
          label: `Bonus ${reached.tier_name} ${cat}`,
          amount: reached.incentive_value,
          type: 'bonus',
        })
      } else if (reached.incentive_type === 'percentage') {
        const extra = sales * reached.incentive_value
        bonuses.push({
          category: cat,
          tier: reached.tier_name,
          label: `+${(reached.incentive_value * 100).toFixed(1)}% ${cat}`,
          amount: extra,
          type: 'percentage',
        })
      } else if (reached.incentive_type === 'multiplier') {
        multiplier = Math.max(multiplier, reached.incentive_value)
        bonuses.push({
          category: cat,
          tier: reached.tier_name,
          label: `×${reached.incentive_value} ${cat}`,
          amount: 0,
          type: 'multiplier',
        })
      }
    }
  }

  const bonusFixed = bonuses.filter(b => b.type !== 'multiplier').reduce((a, b) => a + b.amount, 0)
  const total = base * multiplier + bonusFixed

  return { base, bonuses, total, multiplier }
}
