'use server'

import { createClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitoring.server'
import type { IncentiveRule, CommissionConfig, CommissionTier } from '@/types'

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getIncentiveRules(clientId: string): Promise<{
  rules: IncentiveRule[]
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('incentive_rules')
      .select('*')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('category')
      .order('threshold_amount')
    if (error) throw error
    return { rules: (data ?? []) as IncentiveRule[], error: null }
  } catch (err) {
    await captureError(err, { module: 'incentives/getRules', client_id: clientId })
    return { rules: [], error: 'No se pudieron cargar las reglas de incentivos' }
  }
}

export async function getCommissionConfig(clientId: string): Promise<{
  config: CommissionConfig | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('commission_config')
      .select('*')
      .eq('client_id', clientId)
      .eq('active', true)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return { config: (data as CommissionConfig) ?? null, error: null }
  } catch (err) {
    await captureError(err, { module: 'incentives/getConfig', client_id: clientId })
    return { config: null, error: 'No se pudo cargar la configuración de comisiones' }
  }
}

// ─── Escritura (solo admin) ───────────────────────────────────────────────────

export async function upsertIncentiveRule(
  clientId: string,
  rule: Omit<IncentiveRule, 'id' | 'client_id' | 'created_at'> & { id?: string }
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').single()
    if (roleData?.role !== 'admin') return { error: 'No autorizado' }

    const { error } = await supabase.from('incentive_rules').upsert({
      ...(rule.id ? { id: rule.id } : {}),
      client_id:        clientId,
      category:         rule.category,
      threshold_amount: rule.threshold_amount,
      incentive_type:   rule.incentive_type,
      incentive_value:  rule.incentive_value,
      tier_name:        rule.tier_name,
      active:           rule.active,
    })
    if (error) throw error
    return { error: null }
  } catch (err) {
    await captureError(err, { module: 'incentives/upsertRule', client_id: clientId })
    return { error: 'Error al guardar la regla' }
  }
}

export async function deleteIncentiveRule(ruleId: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').single()
    if (roleData?.role !== 'admin') return { error: 'No autorizado' }

    const { error } = await supabase
      .from('incentive_rules')
      .update({ active: false })
      .eq('id', ruleId)
    if (error) throw error
    return { error: null }
  } catch (err) {
    await captureError(err, { module: 'incentives/deleteRule' })
    return { error: 'Error al eliminar la regla' }
  }
}

export async function upsertCommissionConfig(
  clientId: string,
  config: { base_type: 'flat' | 'tiered'; base_percentage: number; tiers: CommissionTier[] }
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').single()
    if (roleData?.role !== 'admin') return { error: 'No autorizado' }

    // Desactivar configuraciones previas
    await supabase
      .from('commission_config')
      .update({ active: false })
      .eq('client_id', clientId)

    const { error } = await supabase.from('commission_config').insert({
      client_id:       clientId,
      base_type:       config.base_type,
      base_percentage: config.base_percentage,
      tiers:           config.tiers,
      active:          true,
    })
    if (error) throw error
    return { error: null }
  } catch (err) {
    await captureError(err, { module: 'incentives/upsertConfig', client_id: clientId })
    return { error: 'Error al guardar la configuración' }
  }
}

// ─── Motor de cálculo de comisión ─────────────────────────────────────────────

/** Calcula la comisión total dado un mapa de ventas por categoría + reglas */
export function calcCommission(
  salesByCategory: Record<string, number>,
  config: CommissionConfig | null,
  rules: IncentiveRule[]
): import('@/types').CommissionResult {
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
  const bonuses: import('@/types').CommissionResult['bonuses'] = []
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
          amount: 0, // el multiplicador afecta a base, no es suma fija
          type: 'multiplier',
        })
      }
    }
  }

  const bonusFixed = bonuses.filter(b => b.type !== 'multiplier').reduce((a, b) => a + b.amount, 0)
  const total = base * multiplier + bonusFixed

  return { base, bonuses, total, multiplier }
}
