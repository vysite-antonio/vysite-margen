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


