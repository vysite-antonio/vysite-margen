import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS, CycleStatus, REPORT_TYPE_LABELS, REPORT_TYPE_ICONS } from '@/types'
import Link from 'next/link'
import CreateCycleButton from '@/components/admin/CreateCycleButton'
import UploadReportButton from '@/components/admin/UploadReportButton'
import UpdateKPIsForm from '@/components/admin/UpdateKPIsForm'
import UpdateCycleStatus from '@/components/admin/UpdateCycleStatus'

export default async function AdminClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  const { data: cycles } = await supabase
    .from('analysis_cycles')
    .select('*, uploaded_files(*), reports(*), kpis(*)')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  const latestCycle = cycles?.[0] || null
  const kpis = latestCycle?.kpis?.[0] || null

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-400 hover:text-white text-sm transition-colors">← Admin</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-medium">{client.company_name}</span>
          </div>
          <Link href={`/admin/clients/${id}/config`}
            className="text-slate-400 hover:text-white text-xs border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors">
            Configuración
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-start justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg mb-1">{client.company_name}</h1>
            <p className="text-slate-400 text-sm">{client.contact_name}</p>
            <p className="text-slate-500 text-xs">{client.contact_email}</p>
            <div className="flex gap-2 mt-3">
              <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">ERP: {client.config?.erp || 'PCCOM'}</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">Plan: {client.plan || 'inicio'}</span>
            </div>
          </div>
          <CreateCycleButton clientId={client.id}/>
        </div>

        {latestCycle && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Ciclo activo</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  {new Date(latestCycle.period_start).toLocaleDateString('es-ES')} — {new Date(latestCycle.period_end).toLocaleDateString('es-ES')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-3 py-1 rounded-full border ${CYCLE_STATUS_COLORS[latestCycle.status as CycleStatus]}`}>
                  {CYCLE_STATUS_LABELS[latestCycle.status as CycleStatus]}
                </span>
                <UpdateCycleStatus cycleId={latestCycle.id} currentStatus={latestCycle.status}/>
              </div>
            </div>

            <div>
              <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">Archivos CSV del cliente</h3>
              {latestCycle.uploaded_files?.length > 0 ? (
                <div className="space-y-2">
                  {latestCycle.uploaded_files.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">📄</span>
                        <div>
                          <p className="text-white text-sm">{file.file_name}</p>
                          <p className="text-slate-500 text-xs">{new Date(file.uploaded_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                        </div>
                      </div>
                      <a href={`/api/download?path=${encodeURIComponent(file.file_path)}&bucket=csv-uploads`} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">Descargar</a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-lg p-4 text-center">
                  <p className="text-slate-500 text-sm">El cliente aún no ha subido CSV</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">Informes generados</h3>
              <div className="grid gap-2">
                {(['oportunidades','comerciales','dashboard'] as const).map(type => {
                  const report = latestCycle.reports?.find((r: any) => r.report_type === type)
                  return (
                    <div key={type} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{REPORT_TYPE_ICONS[type]}</span>
                        <div>
                          <p className="text-white text-sm">{REPORT_TYPE_LABELS[type]}</p>
                          <p className="text-slate-500 text-xs">{report ? `Subido ${new Date(report.uploaded_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}` : 'No subido'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {report && <a href={`/api/download?path=${encodeURIComponent(report.file_path)}&bucket=reports`} className="text-slate-400 hover:text-white text-xs transition-colors">Ver</a>}
                        <UploadReportButton cycleId={latestCycle.id} clientId={client.id} reportType={type} existingReportId={report?.id}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">KPIs del análisis</h3>
              <UpdateKPIsForm cycleId={latestCycle.id} clientId={client.id} existingKpis={kpis}/>
            </div>
          </div>
        )}

        {!latestCycle && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm mb-3">No hay ciclos configurados para este cliente.</p>
            <CreateCycleButton clientId={client.id}/>
          </div>
        )}
      </div>
    </div>
  )
}

