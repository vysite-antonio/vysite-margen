'use server'

import { createClient } from '@/lib/supabase/server'

// ─── Helper: verificar admin ─────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'No autenticado' }
  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') return { supabase, user, error: 'Sin permisos' }
  return { supabase, user, error: null }
}

// ─── Configuración de cliente ─────────────────────────────────────────────────

interface UpdateClientConfigPayload {
  plan?: string
  comercial_display_names?: Record<string, string>
  erp_profile_id?: string | null
}

export async function updateClientConfig(
  clientId: string,
  payload: UpdateClientConfigPayload
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { error: authError }

  const { data: current, error: fetchError } = await supabase
    .from('clients').select('config').eq('id', clientId).single()
  if (fetchError) return { error: 'Error al obtener cliente' }

  const updates: Record<string, unknown> = {}

  if (payload.plan !== undefined) updates.plan = payload.plan
  if (payload.erp_profile_id !== undefined) updates.erp_profile_id = payload.erp_profile_id

  if (payload.comercial_display_names !== undefined) {
    updates.config = {
      ...(current?.config ?? {}),
      comercial_display_names: payload.comercial_display_names,
    }
  }

  if (Object.keys(updates).length === 0) return { error: null }

  const { error: updateError } = await supabase
    .from('clients').update(updates).eq('id', clientId)

  if (updateError) return { error: updateError.message }
  return { error: null }
}

// ─── Perfiles ERP ─────────────────────────────────────────────────────────────

export interface ErpFileType {
  key: string
  label: string
  description: string
  encoding: 'utf-8' | 'windows-1252'
  separator: ';' | ','
  column_mapping: Record<string, string>
  required_columns: string[]
  analysis_capabilities: string[]
}

export interface ErpProfilePayload {
  name: string
  slug: string
  description: string
  file_types: ErpFileType[]
}

export async function upsertErpProfile(
  id: string | null,
  payload: ErpProfilePayload
): Promise<{ error: string | null; id?: string }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { error: authError }

  if (id) {
    // Update existente
    const { error } = await supabase
      .from('erp_profiles')
      .update({
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        file_types: payload.file_types,
      })
      .eq('id', id)
    if (error) return { error: error.message }
    return { error: null, id }
  } else {
    // Nuevo perfil
    const { data, error } = await supabase
      .from('erp_profiles')
      .insert({
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        file_types: payload.file_types,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    return { error: null, id: data.id }
  }
}

export async function deleteErpProfile(id: string): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { error: authError }

  // Desasignar clientes que usaban este perfil
  await supabase.from('clients').update({ erp_profile_id: null }).eq('erp_profile_id', id)

  const { error } = await supabase.from('erp_profiles').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}
