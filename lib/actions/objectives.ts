'use server'

import { createClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitoring.server'

// ─── Tipos (re-exportados desde utils para compatibilidad) ────────────────────
export type {
  ScopeType,
  MetricType,
  PeriodType,
  CommissionType,
  AppliesTo,
  CommissionTier,
  ObjectiveInput,
  Objective,
  ObjectiveProgress,
} from '@/lib/utils/objectives'

import type { Objective, ObjectiveInput } from '@/lib/utils/objectives'

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getObjectives(clientId: string): Promise<{
  objectives: Objective[]
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('objectives')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { objectives: (data ?? []) as Objective[], error: null }
  } catch (err) {
    await captureError(err, { module: 'objectives/get', client_id: clientId })
    return { objectives: [], error: 'Error al cargar objetivos' }
  }
}

export async function getActiveObjectives(clientId: string): Promise<{
  objectives: Objective[]
}> {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('objectives')
      .select('*')
      .eq('client_id', clientId)
      .eq('active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: true })
    return { objectives: (data ?? []) as Objective[] }
  } catch {
    return { objectives: [] }
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createObjective(
  clientId: string,
  input: ObjectiveInput
): Promise<{ id: string | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { id: null, error: 'No autenticado' }
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (role?.role !== 'admin') return { id: null, error: 'Sin permisos' }

    const { data, error } = await supabase
      .from('objectives')
      .insert({ client_id: clientId, ...input })
      .select('id')
      .single()

    if (error) throw error
    return { id: data.id, error: null }
  } catch (err) {
    await captureError(err, { module: 'objectives/create', client_id: clientId })
    return { id: null, error: 'Error al crear objetivo' }
  }
}

export async function updateObjective(
  objectiveId: string,
  input: Partial<ObjectiveInput>
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('objectives')
      .update(input)
      .eq('id', objectiveId)

    if (error) throw error
    return { error: null }
  } catch (err) {
    await captureError(err, { module: 'objectives/update' })
    return { error: 'Error al actualizar objetivo' }
  }
}

export async function deleteObjective(objectiveId: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('objectives')
      .update({ active: false })
      .eq('id', objectiveId)
    if (error) throw error
    return { error: null }
  } catch (err) {
    await captureError(err, { module: 'objectives/delete' })
    return { error: 'Error al eliminar objetivo' }
  }
}

// Las funciones puras calcObjectiveProgress y extractCurrentValue están en
// @/lib/utils/objectives (sin 'use server') para poder importarse desde cliente.
