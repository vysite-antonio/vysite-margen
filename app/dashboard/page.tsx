import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import {
  CycleStatus,
  CYCLE_STATUS_LABELS,
  CYCLE_STATUS_COLORS,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_ICONS,
} from '@/types'
import UploadCSVButton from '@/components/client/UploadCSVButton'
import SignOutButton from '@/components/SignOutButton'

// ─── Tipos internos ────────────────────────────────────────────────────────────

interface OportunidadesPorTipo {
  categoria_perdida: number
  mix_suboptimo: number
  cliente_caida: number
  producto_no_ofrecido: number
}

// ─── Componente principal (Server Component) ───────────────────────────────────

export default async function ClientDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('clients').select('*').eq('user_id', user.id).single()
  if (!client) redirect('/login')

  // Fetch paralelo: ciclos + último ciclo con todo
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
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-950/90 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center shrink-0">
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

        {/* ── Sin ciclo configurado ────────────────────────────────────────── */}
        {!latestCycle && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h2 className="text-white font-semibold text-lg mb-2">Bienvenido a Vysite Margen</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Tu primer análisis está siendo configurado. Recibirás un aviso cuando esté listo para subir tu CSV.
            </p>
          </div>
        )}

        {/* ── Estado del ciclo activo ──────────────────────────────────────── */}
        {latestCycle && (
          <CicloActivo cycle={latestCycle} clientId={client.id} />
        )}

        {/* ── Resumen Ejecutivo (solo si hay KPIs) ─────────────────────────── */}
        {kpis && (
          <Suspense fallback={<KPISkeleton />}>
            <ResumenEjecutivo kpis={kpis} />
          </Suspense>
        )}

        {/* ── Oportunidades por tipo ───────────────────────────────────────── */}
        {kpis?.oportunidades_por_tipo && (
          <OportunidadesPorTipoModule
            data={kpis.oportunidades_por_tipo as OportunidadesPorTipo}
            potencialTotal={kpis.potencial_mensual}
          />
        )}

        {/* ── Drive: Informes disponibles ──────────────────────────────────── */}
        {reports.length > 0 && (
          <InformesModule reports={reports} />
        )}

      </main>
    </div>
  )
}

// ─── Módulo: Ciclo activo ──────────────────────────────────────────────────────

function CicloActivo({ cycle, clientId }: { cycle: any; clientId: string }) {
  const status = cycle.status as CycleStatus
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-white font-semibold">Ciclo de análisis</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date(cycle.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}
            {' — '}
            {new Date(cycle.period_end).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${CYCLE_STATUS_COLORS[status]}`}>
          {CYCLE_STATUS_LABELS[status]}
        </span>
      </div>

      {status === 'esperando_csv' && (
        <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center">
          <div className="text-3xl mb-3">📤</div>
          <p className="text-white font-medium mb-1">Sube tu archivo CSV</p>
          <p className="text-slate-400 text-sm mb-4">Exporta los datos desde tu ERP y súbelos aquí</p>
          <UploadCSVButton clientId={clientId} cycleId={cycle.id} />
        </div>
      )}

      {status === 'csv_recibido' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-blue-300 font-medium text-sm">CSV recibido correctamente</p>
            <p className="text-blue-400/70 text-xs mt-0.5">Tu análisis está siendo preparado. Te avisaremos cuando esté listo.</p>
          </div>
        </div>
      )}

      {status === 'procesando' && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <p className="text-purple-300 font-medium text-sm">Análisis en proceso</p>
            <p className="text-purple-400/70 text-xs mt-0.5">Estamos identificando tus oportunidades de margen.</p>
          </div>
        </div>
      )}

      {status === 'completado' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="text-emerald-300 font-medium text-sm">Análisis completado</p>
            <p className="text-emerald-400/70 text-xs mt-0.5">Revisa tu resumen ejecutivo y los informes disponibles abajo.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Módulo: Resumen Ejecutivo ─────────────────────────────────────────────────

function ResumenEjecutivo({ kpis }: { kpis: any }) {
  const potencialMensual = kpis.potencial_mensual ?? 0
  const potencialAnual = kpis.potencial_anual ?? 0
  const totalOportunidades = kpis.total_oportunidades ?? 0
  const margenPct = kpis.margen_porcentaje ?? 0
  const clientesActivos = kpis.clientes_activos ?? 0
  const topCategoria = kpis.top_categoria
  const categoriaMayorPotencial = kpis.categoria_mayor_potencial

  return (
    <section>
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border border-emerald-900/40 rounded-2xl p-7 mb-4">
        <p className="text-emerald-400 text-xs font-medium uppercase tracking-widest mb-2">Potencial recuperable</p>
        <div className="flex items-end gap-3 mb-1">
          <span className="text-5xl font-bold text-white tabular-nums">
            {potencialMensual.toLocaleString('es-ES')}
          </span>
          <span className="text-emerald-400 text-lg font-medium mb-1">EUR/mes</span>
        </div>
        <p className="text-slate-400 text-sm">
          Proyección anual:{' '}
          <span className="text-white font-semibold">{potencialAnual.toLocaleString('es-ES')} EUR</span>
        </p>
        {categoriaMayorPotencial && (
          <p className="text-slate-500 text-xs mt-2">
            Mayor oportunidad en: <span className="text-emerald-400">{categoriaMayorPotencial}</span>
          </p>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Oportunidades"
          value={totalOportunidades.toString()}
          sublabel="acciones identificadas"
          color="blue"
        />
        <KPICard
          label="Potencial anual"
          value={`${potencialAnual.toLocaleString('es-ES')} €`}
          sublabel="proyección 12 meses"
          color="amber"
        />
        <KPICard
          label="Margen actual"
          value={`${margenPct.toFixed(1)}%`}
          sublabel="sobre facturación"
          color="slate"
        />
        <KPICard
          label="Clientes activos"
          value={clientesActivos.toString()}
          sublabel={topCategoria ? `top: ${topCategoria}` : 'en cartera'}
          color="slate"
        />
      </div>
    </section>
  )
}

function KPICard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string
  value: string
  sublabel: string
  color: 'blue' | 'amber' | 'emerald' | 'slate'
}) {
  const valueColor =
    color === 'blue' ? 'text-blue-400' :
    color === 'amber' ? 'text-amber-400' :
    color === 'emerald' ? 'text-emerald-400' :
    'text-slate-300'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-slate-400 text-xs mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      <p className="text-slate-500 text-xs mt-1 truncate">{sublabel}</p>
    </div>
  )
}

function KPISkeleton() {
  return (
    <section>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 mb-4 animate-pulse">
        <div className="h-3 w-32 bg-slate-800 rounded mb-3" />
        <div className="h-12 w-48 bg-slate-800 rounded mb-2" />
        <div className="h-3 w-40 bg-slate-800 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
            <div className="h-2 w-20 bg-slate-800 rounded mb-3" />
            <div className="h-7 w-24 bg-slate-800 rounded mb-2" />
            <div className="h-2 w-16 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Módulo: Oportunidades por tipo ───────────────────────────────────────────

const TIPO_CONFIG: Record<
  keyof OportunidadesPorTipo,
  { label: string; icon: string; desc: string; color: string; bar: string }
> = {
  categoria_perdida: {
    label: 'Categorías perdidas',
    icon: '📦',
    desc: 'Clientes que dejaron de comprar categorías de alto margen',
    color: 'text-orange-400',
    bar: 'bg-orange-500',
  },
  mix_suboptimo: {
    label: 'Mix subóptimo',
    icon: '⚖️',
    desc: 'Clientes con mezcla de productos mejorable',
    color: 'text-blue-400',
    bar: 'bg-blue-500',
  },
  cliente_caida: {
    label: 'Clientes en caída',
    icon: '📉',
    desc: 'Clientes con tendencia descendente detectada',
    color: 'text-red-400',
    bar: 'bg-red-500',
  },
  producto_no_ofrecido: {
    label: 'Productos no ofrecidos',
    icon: '🎁',
    desc: 'Productos rentables no vendidos a estos clientes',
    color: 'text-purple-400',
    bar: 'bg-purple-500',
  },
}

function OportunidadesPorTipoModule({
  data,
  potencialTotal,
}: {
  data: OportunidadesPorTipo
  potencialTotal: number
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const items = (Object.keys(data) as (keyof OportunidadesPorTipo)[])
    .map(key => ({ key, value: data[key], ...TIPO_CONFIG[key] }))
    .sort((a, b) => b.value - a.value)

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-white font-semibold mb-5">Oportunidades por tipo</h2>
      <div className="space-y-4">
        {items.map(item => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
          // Valor estimado en EUR proporcional al potencial total
          const valorEUR = potencialTotal > 0
            ? Math.round((item.value / total) * potencialTotal)
            : item.value

          return (
            <div key={item.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-white text-sm font-semibold tabular-nums">
                    {potencialTotal > 0
                      ? `${valorEUR.toLocaleString('es-ES')} €`
                      : `${item.value} oportunidades`}
                  </span>
                  <span className="text-slate-500 text-xs ml-2">{pct}%</span>
                </div>
              </div>
              {/* Barra de progreso */}
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${item.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-slate-600 text-xs mt-1">{item.desc}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Módulo: Drive / Informes ──────────────────────────────────────────────────

function InformesModule({ reports }: { reports: any[] }) {
  return (
    <section>
      <h2 className="text-white font-semibold mb-4">Informes disponibles</h2>
      <div className="grid gap-3">
        {reports.map((report: any) => (
          <div
            key={report.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{REPORT_TYPE_ICONS[report.report_type as keyof typeof REPORT_TYPE_ICONS]}</span>
              <div>
                <p className="text-white text-sm font-medium">
                  {REPORT_TYPE_LABELS[report.report_type as keyof typeof REPORT_TYPE_LABELS]}
                </p>
                <p className="text-slate-500 text-xs">
                  {new Date(report.uploaded_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <a
              href={`/api/download?path=${encodeURIComponent(report.file_path)}&bucket=reports`}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs px-4 py-2 rounded-lg transition-colors"
            >
              Descargar
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}
