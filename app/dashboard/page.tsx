import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { PlanTier } from '@/types'
import DashboardTabs from '@/components/client/DashboardTabs'

export default async function ClientDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!client) redirect('/login')

  // Fetch último ciclo con archivos, informes y KPIs
  const { data: cycles } = await supabase
    .from('analysis_cycles')
    .select('*, uploaded_files(*), reports(*), kpis(*)')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const latestCycle = cycles?.[0] ?? null
  const kpis = latestCycle?.kpis?.[0] ?? null

  // Normalizar el ciclo (quitar el array kpis anidado que no necesita DashboardTabs)
  const cycle = latestCycle
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
