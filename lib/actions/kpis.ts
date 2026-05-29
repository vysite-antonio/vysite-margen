'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitoring.server'
import type { KPIs } from '@/types'

// ─── Helper: verificar admin ──────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'No autenticado' as string }
  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') return { user, error: 'Sin permisos' as string }
  return { user, error: null }
}

// ─── updateKPIs: guardar KPIs manualmente (solo admin) ───────────────────────

export interface KPIsPayload {
  cycleId: string
  clientId: string
  existingKpiId?: string
  values: {
    total_oportunidades: number
    potencial_mensual: number
    facturacion_total: number
    margen_total: number
    clientes_activos: number
    top_categoria: string
    categoria_mayor_potencial: string
    cat_perdida: number
    mix_suboptimo: number
    cliente_caida: number
    producto_no_ofrecido: number
  }
}

export async function updateKPIsAction(
  payload: KPIsPayload
): Promise<{ error: string | null }> {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError || !user) return { error: authError ?? 'No autenticado' }

    const { cycleId, clientId, existingKpiId, values } = payload

    if (!cycleId || !clientId) return { error: 'Faltan campos requeridos' }

    const potencial_anual = values.potencial_mensual * 12
    const margen_porcentaje =
      values.facturacion_total > 0
        ? Math.round((values.margen_total / values.facturacion_total) * 10000) / 100
        : 0

    const record = {
      cycle_id:                 cycleId,
      client_id:                clientId,
      total_oportunidades:      values.total_oportunidades,
      potencial_mensual:        values.potencial_mensual,
      potencial_anual,
      facturacion_total:        values.facturacion_total,
      margen_total:             values.margen_total,
      margen_porcentaje,
      clientes_activos:         values.clientes_activos,
      top_categoria:            values.top_categoria,
      categoria_mayor_potencial: values.categoria_mayor_potencial,
      oportunidades_por_tipo: {
        categoria_perdida:    values.cat_perdida,
        mix_suboptimo:        values.mix_suboptimo,
        cliente_caida:        values.cliente_caida,
        producto_no_ofrecido: values.producto_no_ofrecido,
      },
      source: 'manual' as const,
    }

    // Usar service client: las escrituras en kpis requieren privilegios elevados
    // (la tabla usa RLS basada en JWT claims que puede no estar configurada)
    const serviceClient = createServiceClient()

    if (existingKpiId) {
      const { error } = await serviceClient
        .from('kpis')
        .update(record)
        .eq('id', existingKpiId)
      if (error) throw error
    } else {
      const { error } = await serviceClient
        .from('kpis')
        .insert(record)
      if (error) throw error
    }

    await serviceClient.from('system_logs').insert({
      action:    'kpis_actualizados',
      user_id:   user.id,
      client_id: clientId,
      details:   { cycle_id: cycleId, potencial_mensual: values.potencial_mensual },
    })

    return { error: null }
  } catch (err) {
    await captureError(err, { module: 'kpis/update' })
    return { error: err instanceof Error ? err.message : 'Error al guardar KPIs' }
  }
}
