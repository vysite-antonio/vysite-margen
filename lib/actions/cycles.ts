'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitoring.server'
import type { CycleStatus } from '@/types'

// ─── updateCycleStatus: actualizar estado de ciclo (solo admin) ───────────────

export async function updateCycleStatus(
  cycleId: string,
  newStatus: CycleStatus,
  oldStatus: CycleStatus
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).single()
    if (roleData?.role !== 'admin') return { error: 'Sin permisos' }

    const serviceClient = createServiceClient()

    const { error } = await serviceClient
      .from('analysis_cycles')
      .update({ status: newStatus })
      .eq('id', cycleId)
    if (error) throw error

    await serviceClient.from('system_logs').insert({
      action:  'ciclo_actualizado',
      user_id: user.id,
      details: { cycle_id: cycleId, old_status: oldStatus, new_status: newStatus },
    })

    return { error: null }
  } catch (err) {
    await captureError(err, { module: 'cycles/updateStatus' })
    return { error: 'Error al actualizar el estado del ciclo' }
  }
}

// ─── Cálculo automático de período ───────────────────────────────────────────

function calcCurrentPeriod(): { start: string; end: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()

  const fmt = (date: Date) => date.toISOString().split('T')[0]

  if (d <= 15) {
    return {
      start: fmt(new Date(y, m, 1)),
      end:   fmt(new Date(y, m, 15)),
    }
  } else {
    return {
      start: fmt(new Date(y, m, 16)),
      end:   fmt(new Date(y, m + 1, 0)), // último día del mes
    }
  }
}

// ─── requestNewCycle: el cliente solicita un nuevo ciclo ─────────────────────

/**
 * Crea un nuevo ciclo de análisis para el cliente autenticado.
 * Solo permitido si no hay ningún ciclo activo (esperando_csv, csv_recibido, procesando).
 */
export async function requestNewCycle(): Promise<{
  error: string | null
  cycleId?: string
  periodLabel?: string
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  // Obtener cliente
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, plan')
    .eq('user_id', user.id)
    .single()
  if (clientError || !client) return { error: 'Cliente no encontrado' }

  // Comprobar que no existe ciclo activo
  const { data: activeCycles } = await supabase
    .from('analysis_cycles')
    .select('id, status')
    .eq('client_id', client.id)
    .in('status', ['esperando_csv', 'csv_recibido', 'procesando'])
    .is('deleted_at', null)

  if (activeCycles && activeCycles.length > 0) {
    return { error: 'Ya tienes un ciclo en curso. Espera a que finalice antes de solicitar uno nuevo.' }
  }

  const { start, end } = calcCurrentPeriod()

  // Llamar al RPC (SECURITY DEFINER — verifica existencia del cliente)
  const { data: cycleId, error: rpcError } = await supabase
    .rpc('create_analysis_cycle', {
      p_client_id:    client.id,
      p_period_start: start,
      p_period_end:   end,
    })

  if (rpcError) {
    await captureError(rpcError, { module: 'requestNewCycle', client_id: client.id })
    return { error: 'No se pudo crear el ciclo. Inténtalo de nuevo.' }
  }

  const startDate = new Date(start)
  const endDate   = new Date(end)
  const periodLabel = `${startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })} – ${endDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`

  return { error: null, cycleId, periodLabel }
}
