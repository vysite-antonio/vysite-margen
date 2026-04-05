import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS, CycleStatus,
  AdminClientRow, AdminStatCycle, SystemLog,
} from '@/types'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import { captureError } from '@/lib/monitoring.server'

// ── Plan tier config ──────────────────────────────────────────────────────────

const PLAN_ORDER: Record<string, number> = { inicio: 0, crecimiento: 1, estrategico: 2 }

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  inicio:      { label: 'Inicio',      cls: 'text-slate-400 bg-slate-800 border-slate-700' },
  crecimiento: { label: 'Crecimiento', cls: 'text-blue-400 bg-blue-950/50 border-blue-800/60' },
  estrategico: { label: 'Estratégico', cls: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60' },
}

// Características que requieren plan mínimo, para mostrar indicadores de bloqueo
const PLAN_FEATURES = [
  { label: 'Oportunidades',  icon: '🎯', required: 'crecimiento' },
  { label: 'Comerciales',    icon: '👤', required: 'estrategico' },
  { label: 'Riesgo',         icon: '⚠️',  required: 'estrategico' },
]

function isPlanUnlocked(clientPlan: string, required: string) {
  return (PLAN_ORDER[clientPlan] ?? 0) >= (PLAN_ORDER[required] ?? 99)
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleError || roleData?.role !== 'admin') redirect('/dashboard')

  let clients: AdminClientRow[] = []
  let logs: SystemLog[] = []
  let allCycles: AdminStatCycle[] = []

  try {
    const [clientsRes, logsRes, cyclesRes] = await Promise.all([
      supabase
        .from('clients')
        .select(`id, company_name, contact_name, contact_email, plan, is_active,
          analysis_cycles(id, status, period_start, period_end, updated_at, created_at,
            uploaded_files(id, uploaded_at), reports(id), kpis(potencial_mensual, total_oportunidades))`)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('company_name'),
      supabase
        .from('system_logs').select('*').order('created_at', { ascending: false }).limit(20),
      supabase
        .from('analysis_cycles').select('status, kpis(potencial_mensual)'),
    ])
    if (clientsRes.error) await captureError(clientsRes.error, { module: 'admin/clients' })
    else clients = (clientsRes.data ?? []) as AdminClientRow[]
    if (logsRes.error) await captureError(logsRes.error, { module: 'admin/logs' })
    else logs = (logsRes.data ?? []) as SystemLog[]
    if (cyclesRes.error) await captureError(cyclesRes.error, { module: 'admin/cycles' })
    else allCycles = (cyclesRes.data ?? []) as AdminStatCycle[]
  } catch (err) {
    await captureError(err, { module: 'admin' })
  }

  const stats = {
    total_clients:   clients.length,
    pending_csv:     allCycles.filter(c => c.status === 'esperando_csv').length,
    csv_received:    allCycles.filter(c => c.status === 'csv_recibido').length,
    completed:       allCycles.filter(c => c.status === 'completado').length,
    total_potential: allCycles.reduce((acc, c) => acc + (c.kpis[0]?.potencial_mensual ?? 0), 0),
  }

  const logEmoji: Record<string, string> = {
    csv_subido:'📤', informe_subido:'📊', kpis_actualizados:'🎯',
    ciclo_creado:'🔄', cliente_creado:'👤', login:'🔑', logout:'🚪',
    error_aplicacion:'🔴', error_cliente:'🟠',
  }
  const logLabel: Record<string, string> = {
    csv_subido:'CSV subido', informe_subido:'Informe subido', kpis_actualizados:'KPIs actualizados',
    ciclo_creado:'Ciclo creado', cliente_creado:'Cliente creado', ciclo_actualizado:'Ciclo actualizado',
    login:'Acceso al sistema', logout:'Cierre de sesión',
    error_aplicacion:'Error de servidor', error_cliente:'Error de cliente',
  }

  const KPI_STATS = [
    { label: 'Clientes activos', value: stats.total_clients.toString(),             color: 'text-white' },
    { label: 'Esperando CSV',    value: stats.pending_csv.toString(),               color: 'text-amber-400' },
    { label: 'CSV recibidos',    value: stats.csv_received.toString(),              color: 'text-blue-400' },
    { label: 'Completados',      value: stats.completed.toString(),                 color: 'text-emerald-400' },
  ]

  return (
    <div className="min-h-screen bg-slate-950">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          {/* Fila superior: logo + cerrar sesión */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs">VM</span>
              </div>
              <span className="text-white font-medium text-sm">Vysite Margen</span>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                Admin
              </span>
            </div>
            <SignOutButton />
          </div>

          {/* Fila de navegación — scroll horizontal en móvil */}
          <nav className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1">
            <Link
              href="/admin/comerciales"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <span>👤</span>
              <span>Comerciales</span>
            </Link>
            <Link
              href="/admin/erp-profiles"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <span>🔌</span>
              <span>Perfiles ERP</span>
            </Link>
            <Link
              href="/admin/clients/new"
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ml-auto"
            >
              <span>+</span>
              <span>Nuevo cliente</span>
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── KPI Grid 2×2 + card potencial ─────────────────────────────── */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3 mb-3">
            {KPI_STATS.map((s) => (
              <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[80px]">
                <p className="text-slate-500 text-xs mb-2 leading-tight">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          {/* Card potencial — ancho completo */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-slate-500 text-xs">Potencial total mensual</p>
            <p className="text-emerald-400 text-xl font-bold tabular-nums">
              {stats.total_potential > 0
                ? `${stats.total_potential.toLocaleString('es-ES')} €`
                : '—'}
            </p>
          </div>
        </div>

        {/* ── Contenido principal ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Lista de clientes */}
          <div className="lg:col-span-2">
            <h2 className="text-white font-semibold mb-4 text-sm">Estado de clientes</h2>
            <div className="space-y-3">
              {clients.map((client) => {
                const latestCycle = [...client.analysis_cycles].sort(
                  (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                )[0]
                const plan       = client.plan ?? 'inicio'
                const planBadge  = PLAN_BADGE[plan] ?? PLAN_BADGE.inicio
                const lockedFeatures = PLAN_FEATURES.filter(f => !isPlanUnlocked(plan, f.required))

                return (
                  <Link
                    key={client.id}
                    href={`/admin/clients/${client.id}`}
                    className="block bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 sm:p-5 transition-colors"
                  >
                    {/* Cabecera de tarjeta */}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-white font-medium text-sm">{client.company_name}</h3>
                          {/* Badge de plan */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${planBadge.cls}`}>
                            {planBadge.label}
                          </span>
                          {/* Badge de estado del ciclo */}
                          {latestCycle && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${CYCLE_STATUS_COLORS[latestCycle.status as CycleStatus]}`}>
                              {CYCLE_STATUS_LABELS[latestCycle.status as CycleStatus]}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-xs truncate">{client.contact_name} · {client.contact_email}</p>
                      </div>

                      {/* Potencial — alineado a la derecha */}
                      {latestCycle?.kpis?.[0] && (
                        <div className="text-right shrink-0">
                          <p className="text-emerald-400 font-semibold text-sm tabular-nums">
                            {latestCycle.kpis[0].potencial_mensual.toLocaleString('es-ES')} €
                          </p>
                          <p className="text-slate-600 text-[10px]">/mes</p>
                        </div>
                      )}
                    </div>

                    {/* Features bloqueadas por plan — indicadores con candado */}
                    {lockedFeatures.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {lockedFeatures.map(f => (
                          <span
                            key={f.label}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded-full"
                          >
                            <span className="opacity-50">{f.icon}</span>
                            <span>{f.label}</span>
                            <span>🔒</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer del ciclo */}
                    {latestCycle && (
                      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-800">
                        <span className="text-slate-500 text-xs">
                          📅 {new Date(latestCycle.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          {' — '}
                          {new Date(latestCycle.period_end).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-slate-600 text-xs">📁 {latestCycle.uploaded_files?.length || 0} CSV</span>
                        <span className="text-slate-600 text-xs">📊 {latestCycle.reports?.length || 0}/3 informes</span>
                        {latestCycle.status === 'csv_recibido' && (
                          <span className="ml-auto text-amber-400 text-xs font-medium">⚡ Acción requerida</span>
                        )}
                      </div>
                    )}
                    {!latestCycle && (
                      <p className="text-slate-600 text-xs mt-2">Sin ciclos configurados</p>
                    )}
                  </Link>
                )
              })}

              {!clients.length && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                  <p className="text-slate-400 text-sm mb-2">No hay clientes activos.</p>
                  <Link href="/admin/clients/new" className="text-emerald-400 text-sm hover:underline">
                    Crear primer cliente →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Log del sistema */}
          <div>
            <h2 className="text-white font-semibold mb-4 text-sm">Log del sistema</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-slate-800 max-h-[500px] lg:max-h-[600px] overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs shrink-0">{logEmoji[log.action] || '📝'}</span>
                      <span className="text-slate-300 text-xs font-medium truncate">
                        {logLabel[log.action] || log.action}
                      </span>
                    </div>
                    {typeof log.details?.file_name === 'string' && (
                      <p className="text-slate-500 text-xs truncate pl-5">{log.details.file_name as string}</p>
                    )}
                    <p className="text-slate-600 text-xs mt-1 pl-5">
                      {new Date(log.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
                {!logs.length && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-slate-500 text-xs">Sin actividad registrada</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
