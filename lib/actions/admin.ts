'use server'

import { createClient } from '@/lib/supabase/server'

interface UpdateClientConfigPayload {
  plan?: string
  comercial_display_names?: Record<string, string>
}

export async function updateClientConfig(
  clientId: string,
  payload: UpdateClientConfigPayload
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Verificar que es admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (roleData?.role !== 'admin') return { error: 'Sin permisos' }

  // Obtener config actual para hacer merge
  const { data: current, error: fetchError } = await supabase
    .from('clients')
    .select('config')
    .eq('id', clientId)
    .single()
  if (fetchError) return { error: 'Error al obtener cliente' }

  const updates: Record<string, unknown> = {}

  // Actualizar plan si viene
  if (payload.plan !== undefined) {
    updates.plan = payload.plan
  }

  // Merge de config JSONB: solo actualizar los campos que vienen
  if (payload.comercial_display_names !== undefined) {
    updates.config = {
      ...(current?.config ?? {}),
      comercial_display_names: payload.comercial_display_names,
    }
  }

  if (Object.keys(updates).length === 0) return { error: null }

  const { error: updateError } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)

  if (updateError) return { error: updateError.message }
  return { error: null }
}
