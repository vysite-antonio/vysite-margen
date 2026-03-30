import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CycleStatus, CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS, REPORT_TYPE_LABELS, REPORT_TYPE_ICONS } from '@/types'
import UploadCSVButton from '@/components/client/UploadCSVButton'
import SignOutButton from '@/components/SignOutButton'

export default async function ClientDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('clients').select('*').eq('user_id', user.id).single()
  if (!client) redirect('/login')

  const { data: cycles } = await supabase
    .from('analysis_cycles')
    .select('*, uploaded_files(*), reports(*), kpis(*)')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const latestCycle = cycles?.[0] || null
  const kpis = latestCycle?.kpis?.[0] || null
  const reports = latestCycle?.reports || []

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">VM</span>
            </div>
            <div>
              <span className="text-white font-medium text-sm">{client.company_name}</span>
              <p className="text-slate-500 text-xs">{client.contact_name}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {latestCycle ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold mb-1">Análisis en curso</h2>
                <p className="text-slate-400 text-sm">
                  Período: {new Date(latestCycle.period_start).toLocaleDateString('es-ES')} — {new Date(latestCycle.period_end).toLocaleDateString('es-ES')}
                </p>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${CYCLE_STATUS_COLORS[latestCycle.status as CycleStatus]}`}>
                {CYCLE_STATUS_LABELS[latestCycle.status as CycleStatus]}
              </span>
            </div>

            {latestCycle.status === 'esperando_csv' && (
              <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center">
                <div className="text-3xl mb-3">📤</div>
                <p className="text-white font-medium mb-1">Sube tu archivo CSV</p>
                <p className="text-slate-400 text-sm mb-4">Exporta los datos desde tu ERP y súbelos aquí</p>
                <UploadCSVButton clientId={client.id} cycleId={latestCycle.id} />
              </div>
            )}

            {latestCycle.status === 'csv_recibido' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-blue-300 font-medium text-sm">CSV recibido correctamente</p>
                  <p className="text-blue-400/70 text-xs">Tu análisis está siendo preparado.</p>
                </div>
              </div>
            )}

            {latestCycle.status === 'procesando' && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">⚙️</span>
                <div>
                  <p className="text-purple-300 font-medium text-sm">Análisis en proceso</p>
                  <p className="text-purple-400/70 text-xs">Estamos identificando tus oportunidades de margen.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🚀</div>
            <h2 className="text-white font-semibold mb-2">Bienvenido a Vysite Margen</h2>
            <p className="text-slate-400 text-sm">Tu primer análisis está siendo configurado.</p>
          </div>
        )}

        {kpis && (
          <div>
            <h2 className="text-white font-semibold mb-4">Resumen del análisis</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Potencial mensual', value: `${kpis.potencial_mensual.toLocaleString('es-ES')} EUR`, sublabel: 'margen recuperable', accent: 'emerald' },
                { label: 'Oportunidades', value: kpis.total_oportunidades.toString(), sublabel: 'acciones identificadas', accent: 'blue' },
                { label: 'Potencial anual', value: `${kpis.potencial_anual.toLocaleString('es-ES')} EUR`, sublabel: 'proyección 12 meses', accent: 'amber' },
                { label: 'Margen actual', value: `${kpis.margen_porcentaje.toFixed(1)}%`, sublabel: 'sobre facturación', accent: 'slate' },
              ].map((k, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <p className="text-slate-400 text-xs mb-2">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.accent === 'emerald' ? 'text-emerald-400' : k.accent === 'blue' ? 'text-blue-400' : k.accent === 'amber' ? 'text-amber-400' : 'text-slate-300'}`}>{k.value}</p>
                  <p className="text-slate-500 text-xs mt-1">{k.sublabel}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {reports.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-4">Informes disponibles</h2>
            <div className="grid gap-3">
              {reports.map((report: any) => (
                <div key={report.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{REPORT_TYPE_ICONS[report.report_type as keyof typeof REPORT_TYPE_ICONS]}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{REPORT_TYPE_LABELS[report.report_type as keyof typeof REPORT_TYPE_LABELS]}</p>
                      <p className="text-slate-500 text-xs">{new Date(report.uploaded_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <a href={`/api/download?path=${encodeURIComponent(report.file_path)}&bucket=reports`}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-lg transition-colors">
                    Descargar
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

