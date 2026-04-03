import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS, CycleStatus } from '@/types'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import { captureError } from '@/lib/monitoring'

export default async function ComercialDashboard() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'comercial') redirect('/dashboard')

  const displayName = (user.user_metadata?.display_name as string) ?? user.email ?? 'Comercial'

  // Obtener IDs de clientes asignados
  let clients: any[] = []

  try {
    const { data: assignments } = await supabase
      .from('comercial_clients')
      .select('client_id')
      .eq('comercial_user_id', user.id)

    const clientIds = (assignments ?? []).map((a: any) => a.client_id)

    if (clientIds.length > 0) {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id, company_name, contact_name, contact_email, plan,
          analysis_cycles(id, status, period_start, period_end, updated_at,
            kpis(potencial_mensual, margen_porcentaje, facturacion_total)
          )
        `)
        .in('id', clientIds)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('company_name')

      if (clientsError) await captureError(clientsError, { module: 'comercial-dashboard' })
      else clients = clientsData ?? []
    }
  } catch (err) {
    await captureError(err, { module: 'comercial-dashboard' })
  }

  // Calcular stats globales
  const totalPotencial = clients.reduce((acc, c) => {
    const latestCycle = [...(c.analysis_cycles ?? [])].sort((a: any, b: any) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0]
    return acc + ((latestCycle?.kpis?.[0]?.potencial_mensual) ?? 0)
  }, 0)

  const completedCount = clients.filter(c =>
    (c.analysis_cycles ?? []).some((cy: any) => cy.status === 'completado')
  ).length

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <span className="text-white font-medium text-sm">Vysite Margen</span>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">Comercial</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs">{displayName}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-2">Clientes asignados</p>
            <p className="text-2xl font-bold text-white">{clients.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-2">Con análisis completado</p>
            <p className="text-2xl font-bold text-emerald-400">{completedCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs mb-2">Potencial total /mes</p>
            <p className="text-2xl font-bold text-emerald-400">
              {totalPotencial > 0 ? `${totalPotencial.toLocaleString('es-ES')} €` : '—'}
            </p>
          </div>
        </div>

        {/* Lista clientes */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold mb-4">Mis clientes</h2>

          {clients.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
              <p className="text-slate-400 text-sm">No tienes clientes asignados todavía.</p>
              <p className="text-slate-600 text-xs mt-1">Contacta con el administrador para que te asigne clientes.</p>
            </div>
          )}

          {clients.map((client: any) => {
            const sortedCycles = [...(client.analysis_cycles ?? [])].sort(
              (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )
            const latestCycle = sortedCycles[0] ?? null
            const kpis = latestCycle?.kpis?.[0] ?? null

            return (
              <Link
                key={client.id}
                href={`/comercial/cliente/${client.id}`}
                className="block bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-medium text-sm">{client.company_name}</h3>
                      {latestCycle && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CYCLE_STATUS_COLORS[latestCycle.status as CycleStatus]}`}>
                          {CYCLE_STATUS_LABELS[latestCycle.status as CycleStatus]}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs">{client.contact_name} · {client.contact_email}</p>
                  </div>
                  {kpis && (
                    <div className="text-right">
                      <p className="text-emerald-400 font-semibold text-sm">
                        {Number(kpis.potencial_mensual).toLocaleString('es-ES')} €
                      </p>
                      <p className="text-slate-500 text-xs">/mes potencial</p>
                    </div>
                  )}
                </div>
                {latestCycle && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800">
                    <span className="text-slate-500 text-xs">
                      📅 {new Date(latestCycle.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — {new Date(latestCycle.period_end).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                    {kpis && (
                      <>
                        <span className="text-slate-600 text-xs">
                          Margen: {Number(kpis.margen_porcentaje).toFixed(1)}%
                        </span>
                        <span className="text-slate-600 text-xs">
                          Fact: {(Number(kpis.facturacion_total) / 1000).toFixed(0)}K €
                        </span>
                      </>
                    )}
                  </div>
                )}
                {!latestCycle && (
                  <p className="text-slate-600 text-xs mt-2">Sin ciclos configurados</p>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
