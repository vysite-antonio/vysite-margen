import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS, CycleStatus, REPORT_TYPE_LABELS, REPORT_TYPE_ICONS } from '@/types'
import Link from 'next/link'
import CreateCycleButton from '@/components/admin/CreateCycleButton'
import UploadReportButton from '@/components/admin/UploadReportButton'
import UpdateKPIsForm from '@/components/admin/UpdateKPIsForm'
import UpdateCycleStatus from '@/components/admin/UpdateCycleStatus'
import IncentiveConfig from '@/components/client/IncentiveConfig'
import ErpConnectionPanel from '@/components/admin/ErpConnectionPanel'
import DataIngestionTabs from '@/components/admin/DataIngestionTabs'
import { getIncentiveRules, getCommissionConfig } from '@/lib/actions/incentives'
import { getErpConnection, getErpSyncLogs } from '@/lib/actions/erp-connection'
import { getObjectives } from '@/lib/actions/objectives'
import { getComercialsByClient } from '@/lib/actions/comerciales'
import TeamObjectivesView from '@/components/admin/TeamObjectivesView'

export default async function AdminClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  const [cyclesRes, rulesRes, configRes, erpConnRes, erpLogsRes, objectivesRes, comercialesRes] = await Promise.all([
    supabase
      .from('analysis_cycles')
      .select('*, uploaded_files(*), reports(*), kpis(*)')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }),
    getIncentiveRules(client.id),
    getCommissionConfig(client.id),
    getErpConnection(client.id),
    getErpSyncLogs(client.id, 8),
    getObjectives(client.id),
    getComercialsByClient(client.id),
  ])

  const cycles           = cyclesRes.data
  const latestCycle      = cycles?.[0] || null
  const kpis             = latestCycle?.kpis?.[0] || null
  const incentiveRules   = rulesRes.rules
  const commissionConfig = configRes.config
  const erpConnection    = erpConnRes.connection
  const syncLogs         = erpLogsRes.logs
  const objectives       = objectivesRes.objectives
  const comerciales      = comercialesRes.comerciales
  const kpisData         = (kpis?.extended_data as Record<string, unknown>) ?? null

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

        {/* ── Cabecera cliente ──────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-start justify-between">
          <div>
            <h1 className="text-white font-semibold text-lg mb-1">{client.company_name}</h1>
            <p className="text-slate-400 text-sm">{client.contact_name}</p>
            <p className="text-slate-500 text-xs">{client.contact_email}</p>
            <div className="flex gap-2 mt-3">
              <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">ERP: {client.config?.erp || 'PCCOM'}</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">Plan: {client.plan || 'inicio'}</span>
              {erpConnection?.status === 'active' && (
                <span className="text-xs bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 px-3 py-1 rounded-full">
                  ⚡ SQL conectado
                </span>
              )}
            </div>
          </div>
          <CreateCycleButton clientId={client.id}/>
        </div>

        {/* ── Ingesta de datos: tabs CSV / SQL ──────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold text-sm">Ingesta de datos</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Elige el método de carga. Ambos son compatibles y complementarios.
            </p>
          </div>

          <DataIngestionTabs
            clientId={client.id}
            // ── CSV props ──
            latestCycle={latestCycle}
            kpis={kpis}
            // ── SQL props ──
            erpConnection={erpConnection}
            syncLogs={syncLogs}
          />
        </div>

        {/* ── Informes ─────────────────────────────────────────────────────── */}
        {latestCycle && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-white font-semibold text-sm">Informes generados</h3>
            <div className="grid gap-2">
              {(['oportunidades','comerciales','dashboard'] as const).map(type => {
                const report = latestCycle.reports?.find((r: any) => r.report_type === type)
                return (
                  <div key={type} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{REPORT_TYPE_ICONS[type]}</span>
                      <div>
                        <p className="text-white text-sm">{REPORT_TYPE_LABELS[type]}</p>
                        <p className="text-slate-500 text-xs">
                          {report ? `Subido ${new Date(report.uploaded_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}` : 'No subido'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {report && (
                        <a href={`/api/download?path=${encodeURIComponent(report.file_path)}&bucket=reports`}
                          className="text-slate-400 hover:text-white text-xs transition-colors">Ver</a>
                      )}
                      <UploadReportButton cycleId={latestCycle.id} clientId={client.id} reportType={type} existingReportId={report?.id}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Objetivos del equipo ─────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold text-sm">🏆 Objetivos del equipo</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Configura y hace seguimiento de los objetivos de venta y comisiones.
            </p>
          </div>
          <div className="p-6">
            <TeamObjectivesView
              clientId={client.id}
              objectives={objectives}
              comerciales={comerciales}
              kpisData={kpisData}
            />
          </div>
        </div>

        {/* ── Reglas de incentivos ─────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold text-sm mb-4">💰 Reglas de incentivos (simulador)</h3>
          <IncentiveConfig
            clientId={client.id}
            rules={incentiveRules}
            commissionConfig={commissionConfig}
            onRefresh={() => {}}
          />
        </div>

      </div>
    </div>
  )
}
