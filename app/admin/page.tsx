import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS, CycleStatus } from '@/types'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

export default async function AdminDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  const { data: clients } = await supabase
    .from('clients')
    .select(`*, analysis_cycles(id, status, period_start, period_end, updated_at, created_at, uploaded_files(id, uploaded_at), reports(id), kpis(potencial_mensual, total_oportunidades))`)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('company_name')

  const { data: logs } = await supabase
    .from('system_logs').select('*').order('created_at', { ascending: false }).limit(20)

  const { data: allCycles } = await supabase
    .from('analysis_cycles').select('status, kpis(potencial_mensual)')

  const stats = {
    total_clients: clients?.length || 0,
    pending_csv: allCycles?.filter(c => c.status === 'esperando_csv').length || 0,
    csv_received: allCycles?.filter(c => c.status === 'csv_recibido').length || 0,
    completed: allCycles?.filter(c => c.status === 'completado').length || 0,
    total_potential: (allCycles as any[])?.reduce((acc, c) => acc + ((c.kpis as any[])?.[0]?.potencial_mensual || 0), 0) || 0,
  }

  const logEmoji: Record<string, string> = { csv_subido:'📤', informe_subido:'📊', kpis_actualizados:'🎯', ciclo_creado:'🔄', cliente_creado:'👤', login:'🔑', logout:'🚪' }
  const logLabel: Record<string, string> = { csv_subido:'CSV subido', informe_subido:'Informe subido', kpis_actualizados:'KPIs actualizados', ciclo_creado:'Ciclo creado', cliente_creado:'Cliente creado', ciclo_actualizado:'Ciclo actualizado', login:'Acceso al sistema', logout:'Cierre de sesión' }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">VM</span>
            </div>
            <span className="text-white font-medium text-sm">Vysite Margen</span>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/clients/new" className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs px-4 py-2 rounded-lg transition-colors">
              + Nuevo cliente
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label:'Clientes activos', value:stats.total_clients.toString(), accent:'slate' },
            { label:'Esperando CSV', value:stats.pending_csv.toString(), accent:'amber' },
            { label:'CSV recibidos', value:stats.csv_received.toString(), accent:'blue' },
            { label:'Completados', value:stats.completed.toString(), accent:'emerald' },
            { label:'Potencial total', value:`${stats.total_potential.toLocaleString('es-ES')} EUR`, accent:'emerald', sublabel:'/mes' },
          ].map((s,i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs mb-2">{s.label}</p>
              <p className={`text-xl font-bold ${s.accent==='emerald'?'text-emerald-400':s.accent==='blue'?'text-blue-400':s.accent==='amber'?'text-amber-400':'text-white'}`}>
                {s.value}<span className="text-sm font-normal text-slate-500">{s.sublabel}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-white font-semibold mb-4">Estado de clientes</h2>
            {clients?.map((client: any) => {
              const latestCycle = [...(client.analysis_cycles||[])].sort((a:any,b:any) => new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime())[0]
              return (
                <Link key={client.id} href={`/admin/clients/${client.id}`}
                  className="block bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors">
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
                    {latestCycle?.kpis?.[0] && (
                      <div className="text-right">
                        <p className="text-emerald-400 font-semibold text-sm">{latestCycle.kpis[0].potencial_mensual.toLocaleString('es-ES')} EUR</p>
                        <p className="text-slate-500 text-xs">/mes potencial</p>
                      </div>
                    )}
                  </div>
                  {latestCycle && (
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800">
                      <span className="text-slate-500 text-xs">📅 {new Date(latestCycle.period_start).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})} — {new Date(latestCycle.period_end).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</span>
                      <span className="text-slate-600 text-xs">📁 {latestCycle.uploaded_files?.length||0} CSV</span>
                      <span className="text-slate-600 text-xs">📊 {latestCycle.reports?.length||0}/3 informes</span>
                      {latestCycle.status==='csv_recibido' && <span className="ml-auto text-amber-400 text-xs font-medium">⚡ Acción requerida</span>}
                    </div>
                  )}
                  {!latestCycle && <p className="text-slate-600 text-xs mt-2">Sin ciclos configurados</p>}
                </Link>
              )
            })}
            {!clients?.length && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <p className="text-slate-400 text-sm">No hay clientes activos.</p>
                <Link href="/admin/clients/new" className="text-emerald-400 text-sm hover:underline mt-1 inline-block">Crear primer cliente →</Link>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-white font-semibold mb-4">Log del sistema</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
                {logs?.map((log: any) => (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs">{logEmoji[log.action]||'📝'}</span>
                      <span className="text-slate-300 text-xs font-medium">{logLabel[log.action]||log.action}</span>
                    </div>
                    {log.details?.file_name && <p className="text-slate-500 text-xs truncate">{log.details.file_name}</p>}
                    <p className="text-slate-600 text-xs mt-1">{new Date(log.created_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                ))}
                {!logs?.length && <div className="px-4 py-6 text-center"><p className="text-slate-500 text-xs">Sin actividad registrada</p></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

