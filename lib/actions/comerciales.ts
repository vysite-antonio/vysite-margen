'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitoring.server'

// ─── Helper: verificar admin ─────────────────────────────────────────────────
// Devuelve dos clientes:
//   - supabase: cliente de usuario (anon key + sesión cookie) para operaciones RLS
//   - adminClient: service role para llamadas a auth.admin.* que requieren privilegios elevados

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, adminClient: null, user: null, error: 'No autenticado' }
  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') return { supabase, adminClient: null, user, error: 'Sin permisos' }
  const adminClient = createServiceClient()
  return { supabase, adminClient, user, error: null }
}

// ─── Crear cuenta de comercial ────────────────────────────────────────────────

export async function createComercialAccount(
  email: string,
  password: string,
  displayName: string
): Promise<{ error: string | null; userId?: string }> {
  const { supabase, adminClient, error: authError } = await requireAdmin()
  if (authError || !adminClient) return { error: authError ?? 'Sin permisos' }

  const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  })

  if (signUpError || !signUpData.user) {
    await captureError(signUpError, { module: 'createComercialAccount' })
    return { error: signUpError?.message ?? 'Error al crear usuario' }
  }

  const userId = signUpData.user.id

  // Asignar rol comercial
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role: 'comercial' })

  if (roleError) {
    await captureError(roleError, { module: 'createComercialAccount' })
    return { error: 'Usuario creado pero no se pudo asignar rol' }
  }

  await supabase.from('system_logs').insert({
    action: 'comercial_creado',
    details: { email, display_name: displayName, user_id: userId },
  })

  return { error: null, userId }
}

// ─── Actualizar datos de comercial ────────────────────────────────────────────

export async function updateComercialDisplayName(
  userId: string,
  displayName: string
): Promise<{ error: string | null }> {
  const { adminClient, error: authError } = await requireAdmin()
  if (authError || !adminClient) return { error: authError ?? 'Sin permisos' }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: { display_name: displayName },
  })

  return { error: error?.message ?? null }
}

// ─── Asignar cliente a comercial ─────────────────────────────────────────────

export async function assignClientToComercial(
  comercialUserId: string,
  clientId: string
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { error: authError }

  const { error } = await supabase
    .from('comercial_clients')
    .upsert({ comercial_user_id: comercialUserId, client_id: clientId })

  return { error: error?.message ?? null }
}

// ─── Desasignar cliente de comercial ─────────────────────────────────────────

export async function unassignClientFromComercial(
  comercialUserId: string,
  clientId: string
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { error: authError }

  const { error } = await supabase
    .from('comercial_clients')
    .delete()
    .eq('comercial_user_id', comercialUserId)
    .eq('client_id', clientId)

  return { error: error?.message ?? null }
}

// ─── Listar comerciales con sus asignaciones ─────────────────────────────────

export async function listComercialesWithClients(): Promise<{
  error: string | null
  data?: Array<{
    user_id: string
    email: string
    display_name: string
    client_count: number
  }>
}> {
  const { supabase, adminClient, error: authError } = await requireAdmin()
  if (authError || !adminClient) return { error: authError ?? 'Sin permisos' }

  // Obtener users con rol comercial
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'comercial')

  if (!roles?.length) return { error: null, data: [] }

  const userIds = roles.map(r => r.user_id)

  // Obtener datos de usuario via admin API (requiere service role)
  const users = await Promise.all(
    userIds.map(async (uid) => {
      const { data } = await adminClient.auth.admin.getUserById(uid)
      return data?.user
    })
  )

  // Contar asignaciones por comercial
  const { data: assignments } = await supabase
    .from('comercial_clients')
    .select('comercial_user_id')
    .in('comercial_user_id', userIds)

  const countMap: Record<string, number> = {}
  assignments?.forEach(a => {
    countMap[a.comercial_user_id] = (countMap[a.comercial_user_id] ?? 0) + 1
  })

  const result = users
    .filter(Boolean)
    .map(u => ({
      user_id:      u!.id,
      email:        u!.email ?? '',
      display_name: (u!.user_metadata?.display_name as string) ?? u!.email ?? '',
      client_count: countMap[u!.id] ?? 0,
    }))

  return { error: null, data: result }
}

// ─── Listar comerciales asignados a un cliente ────────────────────────────────

export async function getComercialsByClient(clientId: string): Promise<{
  comerciales: Array<{ id: string; name: string; email: string }>
}> {
  try {
    // Solo admins pueden ver los comerciales asignados a un cliente
    const { supabase, adminClient, error: authError } = await requireAdmin()
    if (authError || !adminClient) return { comerciales: [] }

    // Obtener comerciales asignados a este cliente
    const { data: assignments } = await supabase
      .from('comercial_clients')
      .select('comercial_user_id')
      .eq('client_id', clientId)

    if (!assignments?.length) return { comerciales: [] }

    const userIds = assignments.map(a => a.comercial_user_id)

    // Obtener datos de usuario via admin API (requiere service role)
    const users = await Promise.all(
      userIds.map(async (uid) => {
        const { data } = await adminClient.auth.admin.getUserById(uid)
        return data?.user
      })
    )

    const comerciales = users
      .filter(Boolean)
      .map(u => ({
        id:    u!.id,
        name:  (u!.user_metadata?.display_name as string) ?? u!.email ?? u!.id,
        email: u!.email ?? '',
      }))

    return { comerciales }
  } catch {
    return { comerciales: [] }
  }
}
