import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { PlanTier } from '@/types'
import DashboardTabs from '@/components/client/DashboardTabs'
import { captureError } from '@/lib/monitoring'

export default async function ClientDashboard() {
  const supabase = await createClient()

  // Auth: fuera del try/catch para que redirect() funcione correctamente
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (clientError || !client) redirect('/login')

  // Datos del ciclo: si falla, el dashboard se muestra sin ciclo (degradado graceful)
  let cycle = null
  let kpis = null

  try {
    const { data: cycles, error: cyclesError } = await supabase
      .from('analysis_cycles')
      .select('*, uploaded_files(*), reports(*), kpis(*)')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (cyclesError) throw cyclesError

    const latestCycle = cycles?.[0] ?? null
    kpis = latestCycle?.kpis?.[0] ?? null

    cycle = latestCycle
      ? {
          id: latestCycle.id,
          client_id: latestCycle.client_id,
          period_start: latestCycle.period_start,
          period_end: latestCycle.period_end,
          status: latestCycle.status,
          admin_notes: latestCycle.admin_notes,
          created_at: latestCycle.created_at,
          updated_at: latestCycle.updated_at,
          uploaded_files: latestCycle.uploaded_files ?? [],
          reports: latestCycle.reports ?? [],
        }
      : null
  } catch (err) {
    await captureError(err, { module: 'dashboard', client_id: client.id })
    // El dashboard se carga sin ciclo — el usuario ve estado vacío en lugar de error 500
  }

  return (
    <DashboardTabs
      companyName={client.company_name}
      contactName={client.contact_name}
      clientId={client.id}
      plan={(client.plan as PlanTier) ?? 'inicio'}
      config={client.config ?? {}}
      cycle={cycle}
      kpis={kpis}
    />
  )
}
