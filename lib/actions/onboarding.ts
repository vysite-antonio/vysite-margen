'use server'

import { createClient } from '@/lib/supabase/server'
import { requestNewCycle } from '@/lib/actions/cycles'

export interface OnboardingMargins {
  Limpieza:      number
  Drogueria:     number
  Menaje:        number
  Alimentacion:  number
  Bebidas:       number
  Fresco:        number
  Otros:         number
}

/**
 * Guarda los márgenes objetivo del onboarding y solicita el primer ciclo.
 * Marca onboarding_completed: true en config del cliente.
 */
export async function completeOnboarding(margins: OnboardingMargins): Promise<{
  error: string | null
  cycleId?: string
  periodLabel?: string
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  const { data: client } = await supabase
    .from('clients')
    .select('id, config')
    .eq('user_id', user.id)
    .single()

  if (!client) return { error: 'Cliente no encontrado' }

  // Normalizar márgenes: convertir % → decimal si el usuario introdujo 35 en vez de 0.35
  const normalize = (v: number) => (v > 1 ? v / 100 : v)
  const normalizedMargins = Object.fromEntries(
    Object.entries(margins).map(([k, v]) => [k, normalize(v)])
  )

  const updatedConfig = {
    ...(client.config ?? {}),
    margins: { ...(client.config?.margins ?? {}), ...normalizedMargins },
    onboarding_completed: true,
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({ config: updatedConfig })
    .eq('id', client.id)

  if (updateError) return { error: updateError.message }

  // Solicitar primer ciclo
  const cycleResult = await requestNewCycle()
  if (cycleResult.error) {
    // El ciclo falló pero el onboarding ya se marcó como completado
    // No bloqueamos al usuario, simplemente avisamos
    return { error: null }
  }

  return { error: null, cycleId: cycleResult.cycleId, periodLabel: cycleResult.periodLabel }
}

/**
 * Marca el onboarding como completado sin solicitar ciclo (para quien lo omite).
 */
export async function skipOnboarding(): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  const { data: client } = await supabase
    .from('clients')
    .select('id, config')
    .eq('user_id', user.id)
    .single()

  if (!client) return { error: 'Cliente no encontrado' }

  const { error } = await supabase
    .from('clients')
    .update({
      config: { ...(client.config ?? {}), onboarding_completed: true },
    })
    .eq('id', client.id)

  return { error: error?.message ?? null }
}
