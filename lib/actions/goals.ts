'use server'

import { createClient } from '@/lib/supabase/server'
import type { ClientGoals } from '@/types'

/**
 * Guarda los objetivos del cliente autenticado.
 * Solo el propio cliente puede editar sus objetivos.
 */
export async function saveGoals(
  goals: ClientGoals
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  // Obtener config actual del cliente para hacer merge
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, config')
    .eq('user_id', user.id)
    .single()

  if (clientError || !client) return { error: 'Cliente no encontrado' }

  const updatedConfig = {
    ...(client.config ?? {}),
    goals,
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({ config: updatedConfig, updated_at: new Date().toISOString() })
    .eq('id', client.id)

  if (updateError) return { error: updateError.message }

  return { error: null }
}

/**
 * Versión admin: permite guardar objetivos para cualquier cliente.
 */
export async function saveGoalsForClient(
  clientId: string,
  goals: ClientGoals
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') return { error: 'Sin permisos' }

  const { data: client } = await supabase
    .from('clients').select('config').eq('id', clientId).single()

  const updatedConfig = {
    ...(client?.config ?? {}),
    goals,
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({ config: updatedConfig, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  return { error: updateError?.message ?? null }
}
