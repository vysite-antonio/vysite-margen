'use client'

import { useState } from 'react'
import type {
  KPIs,
  KPIsExtendedData,
  OportunidadTipo,
  CycleStatus,
  AnalysisCycle,
  UploadedFile,
  Report,
  PlanTier,
  ClientConfig,
} from '@/types'
import { CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS, REPORT_TYPE_LABELS, REPORT_TYPE_ICONS } from '@/types'
import UploadCSVButton from '@/components/client/UploadCSVButton'
import SignOutButton from '@/components/SignOutButton'
import OportunidadesDonut from '@/components/client/charts/OportunidadesDonut'
import TendenciaChart from '@/components/client/charts/TendenciaChart'
import MargenChart from '@/components/client/charts/MargenChart'
import ComercialesChart from '@/components/client/charts/ComercialesChart'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = 'drive' | 'resumen' | 'margen' | 'oportunidades' | 'comerciales' | 'riesgo'

interface TabDef {
  id: Tab
  label: string
  icon: string
  plan: PlanTier | null  // null = siempre accesible
}

const TABS: TabDef[] = [
  { id: 'drive',        label: 'Archivos',      icon: '📁', plan: null },
  { id: 'resumen',      label: 'Resumen',        icon: '📊', plan: null },
  { id: 'margen',       label: 'Margen',         icon: '💰', plan: null },
  { id: 'oportunidades',label: 'Oportunidades',  icon: '🎯', plan: 'crecimiento' },
  { id: 'comerciales',  label: 'Comerciales',    icon: '👤', plan: 'estrategico' },
  { id: 'riesgo',       label: 'Riesgo',         icon: '⚠️', plan: 'estrategico' },
]

const PLAN_ORDER: Record<PlanTier, number> = {
  inicio: 0,
  crecimiento: 1,
  estrategico: 2,
}

function isPlanUnlocked(clientPlan: PlanTier, required: PlanTier | null): boolean {
  if (!required) return true
  return PLAN_ORDER[clientPlan] >= PLAN_ORDER[required]
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DashboardTabsProps {
  companyName: string
  contactName: string
  clientId: string
  plan: PlanTier
  config: ClientConfig
  cycle: (AnalysisCycle & { uploaded_files: UploadedFile[]; reports: Report[] }) | null
  kpis: KPIs | null
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardTabs({
  companyName,
  contactName,
  clientId,
  plan,
  config,
  cycle,
  kpis,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('drive')

  const csvNuevo = cycle?.uploaded_files?.some(f => {
    const diff = Date.now() - new Date(f.uploaded_at).getTime()
    return diff < 1000 * 60 * 60 * 48  // < 48h
  })

  const clientesActivos = kpis?.clientes_activos ?? 0

  return (
    <div className="min-h-screen bg-slate-950">

      {/* ── Header + tabs ───────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 px-4 sticky top-0 bg-slate-950/95 backdrop-blur-sm z-20">
        <div className="max-w-6xl mx-auto">

          {/* Top row */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs">V</span>
              </div>
              <div>
                <span className="text-white font-semibold text-sm">Vysite Margen</span>
                <p className="text-slate-500 text-xs leading-none mt-0.5">{companyName}</p>
              </div>
              {csvNuevo && (
                <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                  CSV nuevo
                </span>
              )}
              {clientesActivos > 0 && (
                <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium tabular-nums">
                  {clientesActivos}
                </span>
              )}
            </div>
            <SignOutButton />
          </div>

          {/* Tab nav */}
          <nav className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide -mx-1 px-1">
            {TABS.map(tab => {
              const unlocked = isPlanUnlocked(plan, tab.plan)
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap
                    border-b-2 transition-colors relative shrink-0
                    ${isActive
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}
                  `}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {!unlocked && (
                    <span className="text-slate-600 text-[10px]">🔒</span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* ── Contenido ──────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'drive' && (
          <TabDrive cycle={cycle} clientId={clientId} />
        )}
        {activeTab === 'resumen' && (
          <TabResumen kpis={kpis} cycle={cycle} />
        )}
        {activeTab === 'margen' && (
          isPlanUnlocked(plan, 'crecimiento')
            ? <TabMargen kpis={kpis} />
            : <FomoOverlay tab="margen" requiredPlan="crecimiento" kpis={kpis} />
        )}
        {activeTab === 'oportunidades' && (
          isPlanUnlocked(plan, 'crecimiento')
            ? <TabOportunidades kpis={kpis} />
            : <FomoOverlay tab="oportunidades" requiredPlan="crecimiento" kpis={kpis} />
        )}
        {activeTab === 'comerciales' && (
          isPlanUnlocked(plan, 'estrategico')
            ? <TabComerciales kpis={kpis} config={config} />
            : <FomoOverlay tab="comerciales" requiredPlan="estrategico" kpis={kpis} />
        )}
        {activeTab === 'riesgo' && (
          isPlanUnlocked(plan, 'estrategico')
            ? <TabRiesgo kpis={kpis} />
            : <FomoOverlay tab="riesgo" requiredPlan="estrategico" kpis={kpis} />
        )}
      </main>
    </div>
  )
}

// ─── Tab: Drive ───────────────────────────────────────────────────────────────

function TabDrive({
  cycle,
  clientId,
}: {
  cycle: (AnalysisCycle & { uploaded_files: UploadedFile[]; reports: Report[] }) | null
  clientId: string
}) {
  if (!cycle) {
    return (
      <EmptyState
        emoji="🚀"
        title="Bienvenido a Vysite Margen"
        desc="Tu primer análisis está siendo configurado. Recibirás un aviso cuando esté listo para subir tu CSV."
      />
    )
  }

  const status = cycle.status as CycleStatus
  const files = cycle.uploaded_files ?? []
  const reports = cycle.reports ?? []

  return (
    <div className="space-y-5">

      {/* Estado del ciclo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-sm">Ciclo de análisis</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {new Date(cycle.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}
              {' — '}
              {new Date(cycle.period_end).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${CYCLE_STATUS_COLORS[status]}`}>
            {CYCLE_STATUS_LABELS[status]}
          </span>
        </div>

        {status === 'esperando_csv' && (
          <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">📤</div>
            <p className="text-white font-medium text-sm mb-1">Sube tu archivo CSV</p>
            <p className="text-slate-400 text-xs mb-4">Exporta los datos desde tu ERP y súbelos aquí</p>
            <UploadCSVButton clientId={clientId} cycleId={cycle.id} />
          </div>
        )}

        {status === 'csv_recibido' && (
          <StatusBanner color="blue" icon="✅" title="CSV recibido correctamente" desc="Tu análisis está siendo preparado. Te avisaremos cuando esté listo." />
        )}
        {status === 'procesando' && (
          <StatusBanner color="purple" icon="⚙️" title="Análisis en proceso" desc="Estamos identificando tus oportunidades de margen." />
        )}
        {status === 'completado' && (
          <StatusBanner color="emerald" icon="🎯" title="Análisis completado" desc="Consulta las pestañas Resumen, Margen y Oportunidades para ver tus resultados." />
        )}
      </div>

      {/* Archivos CSV subidos */}
      {files.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Archivos importados</h3>
          <div className="space-y-2">
            {files.map(file => {
              const isNew = Date.now() - new Date(file.uploaded_at).getTime() < 1000 * 60 * 60 * 48
              const quality = file.validation_result?.is_valid
                ? (file.validation_result.warnings.length === 0 ? 'A' : 'B')
                : 'C'
              return (
                <div key={file.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-slate-400 shrink-0">📄</span>
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{file.file_name}</p>
                      <p className="text-slate-500 text-xs">
                        {new Date(file.uploaded_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {file.validation_result?.row_count ? ` · ${file.validation_result.row_count.toLocaleString('es-ES')} filas` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {isNew && (
                      <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded font-medium">
                        NUEVO
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                      quality === 'A' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                      quality === 'B' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                      'bg-red-500/15 text-red-400 border border-red-500/25'
                    }`}>Cal. {quality}</span>
                    <a
                      href={`/api/download?path=${encodeURIComponent(file.file_path)}&bucket=csv-uploads`}
                      className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    >
                      ↓
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Informes generados */}
      {reports.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Informes generados</h3>
          <div className="space-y-2">
            {reports.map(report => (
              <div key={report.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{REPORT_TYPE_ICONS[report.report_type]}</span>
                  <div>
                    <p className="text-white text-sm">{REPORT_TYPE_LABELS[report.report_type]}</p>
                    <p className="text-slate-500 text-xs">
                      {new Date(report.uploaded_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/download?path=${encodeURIComponent(report.file_path)}&bucket=reports`}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  Descargar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function TabResumen({
  kpis,
  cycle,
}: {
  kpis: KPIs | null
  cycle: (AnalysisCycle & { uploaded_files: UploadedFile[]; reports: Report[] }) | null
}) {
  if (!kpis) {
    return (
      <EmptyState
        emoji="📊"
        title="Sin datos de análisis"
        desc={cycle ? 'Los KPIs se mostrarán aquí cuando el análisis esté completado.' : 'No hay ciclo configurado aún.'}
      />
    )
  }

  const ext = kpis.extended_data as KPIsExtendedData | undefined
  const potencialMensual = kpis.potencial_mensual ?? 0
  const potencialAnual = kpis.potencial_anual ?? 0
  const totalOportunidades = kpis.total_oportunidades ?? 0
  const margenPct = kpis.margen_porcentaje ?? 0
  const clientesActivos = kpis.clientes_activos ?? 0
  const facturacion = kpis.facturacion_total ?? 0
  const topCategoria = kpis.top_categoria
  const categoriaMayorPotencial = kpis.categoria_mayor_potencial
  const oport = kpis.oportunidades_por_tipo
  const isFacturas = ext?.pipeline === 'facturas'

  return (
    <div className="space-y-5">

      {/* Hero — diferente según pipeline */}
      {isFacturas ? (
        <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-slate-900 border border-blue-900/40 rounded-2xl p-6">
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-2">Facturación del período</p>
          <div className="flex items-end gap-3 mb-1.5">
            <span className="text-5xl font-bold text-white tabular-nums leading-none">
              {(facturacion / 1000).toFixed(0)}K
            </span>
            <span className="text-blue-400 text-lg font-semibold mb-0.5">EUR</span>
          </div>
          <p className="text-slate-400 text-sm">
            {clientesActivos} clientes activos en el período analizado
          </p>
          {ext?.resumen_cobro && ext.resumen_cobro.total_pendiente > 0 && (
            <p className="text-amber-400 text-xs mt-1.5">
              ⚠️ {ext.resumen_cobro.total_pendiente.toLocaleString('es-ES')} € pendientes de cobro
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border border-emerald-900/40 rounded-2xl p-6">
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-2">Potencial recuperable</p>
          <div className="flex items-end gap-3 mb-1.5">
            <span className="text-5xl font-bold text-white tabular-nums leading-none">
              {potencialMensual.toLocaleString('es-ES')}
            </span>
            <span className="text-emerald-400 text-lg font-semibold mb-0.5">EUR/mes</span>
          </div>
          <p className="text-slate-400 text-sm">
            Proyección anual:{' '}
            <span className="text-white font-semibold">{potencialAnual.toLocaleString('es-ES')} EUR</span>
          </p>
          {categoriaMayorPotencial && (
            <p className="text-slate-500 text-xs mt-1.5">
              Mayor oportunidad en: <span className="text-emerald-400">{categoriaMayorPotencial}</span>
            </p>
          )}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isFacturas ? (
          <>
            <KPICard label="Clientes" value={clientesActivos.toString()} sublabel="en el período" color="blue" />
            <KPICard label="Facturación" value={`${(facturacion / 1000).toFixed(0)}K €`} sublabel="total emitido" color="amber" />
            <KPICard label="Tasa cobro" value={`${ext?.resumen_cobro?.tasa_cobro_pct ?? 100}%`} sublabel="importe cobrado" color={((ext?.resumen_cobro?.tasa_cobro_pct) ?? 100) >= 90 ? 'emerald' : 'amber'} />
            <KPICard label="Facturas" value={(ext?.resumen_cobro?.n_facturas ?? 0).toString()} sublabel="emitidas" color="slate" />
          </>
        ) : (
          <>
            <KPICard label="Oportunidades" value={totalOportunidades.toString()} sublabel="acciones identificadas" color="blue" />
            <KPICard label="Facturación" value={`${(facturacion / 1000).toFixed(0)}K €`} sublabel="periodo analizado" color="amber" />
            <KPICard label="Margen actual" value={`${margenPct.toFixed(1)}%`} sublabel="sobre facturación" color="slate" />
            <KPICard label="Clientes activos" value={clientesActivos.toString()} sublabel={topCategoria ? `top: ${topCategoria}` : 'en cartera'} color="slate" />
          </>
        )}
      </div>

      {/* Para pipeline facturas: resumen de cobro + tendencia mensual */}
      {ext?.pipeline === 'facturas' && (
        <>
          {ext.resumen_cobro && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard label="Total facturado" value={`${((ext.resumen_cobro.total_facturado) / 1000).toFixed(0)}K €`} sublabel="período analizado" color="blue" />
              <KPICard label="Cobrado" value={`${((ext.resumen_cobro.total_cobrado) / 1000).toFixed(0)}K €`} sublabel={`tasa ${ext.resumen_cobro.tasa_cobro_pct}%`} color="emerald" />
              <KPICard label="Pendiente" value={`${((ext.resumen_cobro.total_pendiente) / 1000).toFixed(0)}K €`} sublabel="por cobrar" color={ext.resumen_cobro.total_pendiente > 0 ? 'amber' : 'slate'} />
              <KPICard label="Facturas" value={ext.resumen_cobro.n_facturas.toString()} sublabel="en el período" color="slate" />
            </div>
          )}
          {ext.tendencia_mensual && ext.tendencia_mensual.length > 1 && (
            <TendenciaChart data={ext.tendencia_mensual} label="Evolución de facturación mensual" />
          )}
        </>
      )}

      {/* Para pipeline ventas: donut de oportunidades */}
      {ext?.pipeline !== 'facturas' && oport && (
        <OportunidadesDonut oport={oport} potencialTotal={potencialMensual} />
      )}
    </div>
  )
}

// ─── Tab: Margen ──────────────────────────────────────────────────────────────

function TabMargen({ kpis }: { kpis: KPIs | null }) {
  const data = (kpis?.extended_data as KPIsExtendedData)?.margen_por_categoria

  if (!data?.length) {
    return (
      <EmptyState
        emoji="💰"
        title="Datos de margen no disponibles"
        desc="Este módulo se completará cuando el análisis de categorías esté procesado."
      />
    )
  }

  const sorted = [...data].sort((a, b) => b.margen_pct - a.margen_pct)
  const totalFact = sorted.reduce((acc, d) => acc + d.facturacion, 0)

  return (
    <div className="space-y-5">

      {/* Gráfico de barras con Recharts */}
      <MargenChart data={sorted} />

      {/* Tabla */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-sm">Detalle por categoría</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-500 text-xs font-semibold uppercase tracking-wider px-6 py-3">Categoría</th>
                <th className="text-right text-slate-500 text-xs font-semibold uppercase tracking-wider px-4 py-3">Margen %</th>
                <th className="text-right text-slate-500 text-xs font-semibold uppercase tracking-wider px-6 py-3">Facturación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sorted.map(row => (
                <tr key={row.categoria} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-3">
                    <span className="text-white text-sm">{row.categoria}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold tabular-nums ${
                      row.margen_pct >= 30 ? 'text-emerald-400' :
                      row.margen_pct >= 20 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>{row.margen_pct.toFixed(1)}%</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-slate-300 text-sm tabular-nums">
                      {row.facturacion.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
                    </span>
                    <p className="text-slate-600 text-xs tabular-nums">
                      {totalFact > 0 ? ((row.facturacion / totalFact) * 100).toFixed(1) : 0}% del total
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-700 bg-slate-800/30">
                <td className="px-6 py-3 text-slate-400 text-xs font-semibold uppercase">Total</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-slate-300 text-sm font-semibold tabular-nums">
                    {(sorted.reduce((a, b) => a + b.margen_pct, 0) / sorted.length).toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <span className="text-white text-sm font-semibold tabular-nums">
                    {totalFact.toLocaleString('es-ES')} €
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Oportunidades ───────────────────────────────────────────────────────

const TIPO_CONFIG: Record<OportunidadTipo, { label: string; icon: string; color: string; badge: string }> = {
  cliente_caida: {
    label: 'Cliente en caída',
    icon: '📉',
    color: 'text-red-400',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  categoria_perdida: {
    label: 'Categoría perdida',
    icon: '📦',
    color: 'text-orange-400',
    badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  mix_suboptimo: {
    label: 'Mix subóptimo',
    icon: '⚖️',
    color: 'text-blue-400',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  producto_no_ofrecido: {
    label: 'Prod. no ofrecido',
    icon: '🎁',
    color: 'text-purple-400',
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
}

function TabOportunidades({ kpis }: { kpis: KPIs | null }) {
  const ext = kpis?.extended_data as KPIsExtendedData | undefined
  const detalle = ext?.oportunidades_detalle ?? []
  const oport = kpis?.oportunidades_por_tipo
  const potencialTotal = kpis?.potencial_mensual ?? 0

  if (!oport) {
    return (
      <EmptyState
        emoji="🎯"
        title="Datos de oportunidades no disponibles"
        desc="Este módulo se completará cuando el análisis esté procesado."
      />
    )
  }

  // 2x2 cards de tipo
  const tipos = (Object.keys(TIPO_CONFIG) as OportunidadTipo[])
  const total = Object.values(oport).reduce((a, b) => a + b, 0) || 1

  // Top clientes (ordenados por potencial_mes)
  const topClientes = [...detalle].sort((a, b) => b.potencial_mes - a.potencial_mes).slice(0, 10)

  return (
    <div className="space-y-5">

      {/* 2x2 grid tipos */}
      <div className="grid grid-cols-2 gap-3">
        {tipos.map(tipo => {
          const cfg = TIPO_CONFIG[tipo]
          const count = oport[tipo] ?? 0
          const pct = Math.round((count / total) * 100)
          const eur = potencialTotal > 0 ? Math.round((count / total) * potencialTotal) : 0
          return (
            <div key={tipo} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-slate-400 text-xs mb-1">{cfg.icon} {cfg.label}</p>
                  <p className={`text-3xl font-bold tabular-nums ${cfg.color}`}>{count}</p>
                </div>
                <span className="text-xs text-slate-600 font-medium">{pct}%</span>
              </div>
              {eur > 0 && (
                <p className="text-slate-400 text-xs">
                  <span className="text-white font-semibold">{eur.toLocaleString('es-ES')} €</span>/mes potencial
                </p>
              )}
              <div className="h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div className={`h-full rounded-full ${cfg.badge.split(' ')[0].replace('bg-', 'bg-').replace('/15', '')}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Lista clientes */}
      {topClientes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold text-sm">Top clientes con mayor potencial</h2>
          </div>
          <div className="divide-y divide-slate-800/50">
            {topClientes.map((cli, i) => {
              const cfg = TIPO_CONFIG[cli.tipo]
              return (
                <div key={`${cli.cliente_codigo}-${i}`} className="px-5 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-slate-600 text-xs tabular-nums w-5 shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{cli.cliente_nombre}</p>
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border mt-0.5 ${cfg.badge}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-white text-sm font-semibold tabular-nums">
                      {cli.potencial_mes.toLocaleString('es-ES')} €
                    </p>
                    <p className="text-slate-600 text-xs">/ mes</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Comerciales ─────────────────────────────────────────────────────────

function TabComerciales({ kpis, config }: { kpis: KPIs | null; config: ClientConfig }) {
  const ext = kpis?.extended_data as KPIsExtendedData | undefined
  const comerciales = ext?.comerciales ?? []
  const displayNames = config?.comercial_display_names ?? {}
  const pipeline = ext?.pipeline

  if (!comerciales.length) {
    return (
      <EmptyState
        emoji="👤"
        title="Datos de comerciales no disponibles"
        desc="Este módulo se completará cuando el análisis por comercial esté procesado."
      />
    )
  }

  const sorted = [...comerciales].sort((a, b) => b.potencial_mes - a.potencial_mes)

  return (
    <div className="space-y-5">

      {/* Gráfico con Recharts */}
      <ComercialesChart comerciales={sorted} displayNames={displayNames} pipeline={pipeline} />

      {/* Cards detalle — para pipeline facturas mostrar tasa cobro en lugar de margen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map(com => {
          const displayName = displayNames[com.nombre_erp] ?? com.nombre_erp
          const isFacturas = pipeline === 'facturas'
          return (
            <div key={com.nombre_erp} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center mb-2">
                    <span className="text-slate-300 text-xs font-bold">
                      {displayName.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-white font-semibold text-sm">{displayName}</p>
                  {displayName !== com.nombre_erp && (
                    <p className="text-slate-600 text-xs">ERP: {com.nombre_erp}</p>
                  )}
                </div>
                <div className="text-right">
                  {isFacturas ? (
                    <>
                      <p className="text-blue-400 text-lg font-bold tabular-nums">
                        {(com.facturacion / 1000).toFixed(0)}K €
                      </p>
                      <p className="text-slate-600 text-xs">facturación</p>
                    </>
                  ) : (
                    <>
                      <p className="text-blue-400 text-lg font-bold tabular-nums">
                        {com.potencial_mes.toLocaleString('es-ES')} €
                      </p>
                      <p className="text-slate-600 text-xs">potencial/mes</p>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                <div>
                  <p className="text-slate-500 text-xs">Clientes</p>
                  <p className="text-white text-sm font-semibold tabular-nums">{com.n_clientes}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Facturación</p>
                  <p className="text-white text-sm font-semibold tabular-nums">
                    {(com.facturacion / 1000).toFixed(0)}K €
                  </p>
                </div>
                <div>
                  {isFacturas ? (
                    <>
                      <p className="text-slate-500 text-xs">Cobro</p>
                      <p className={`text-sm font-semibold tabular-nums ${
                        (com.tasa_cobro ?? 100) >= 90 ? 'text-emerald-400' :
                        (com.tasa_cobro ?? 100) >= 70 ? 'text-amber-400' : 'text-red-400'
                      }`}>{com.tasa_cobro ?? 100}%</p>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-500 text-xs">Margen</p>
                      <p className={`text-sm font-semibold tabular-nums ${
                        com.margen_pct >= 25 ? 'text-emerald-400' : com.margen_pct >= 15 ? 'text-amber-400' : 'text-red-400'
                      }`}>{com.margen_pct.toFixed(1)}%</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Riesgo ──────────────────────────────────────────────────────────────

const SEVERIDAD_CONFIG: Record<'CRITICO' | 'ATENCION' | 'SEGUIMIENTO', { label: string; badge: string; dot: string }> = {
  CRITICO:     { label: 'CRÍTICO',     badge: 'bg-red-500/15 text-red-400 border-red-500/30',       dot: 'bg-red-500' },
  ATENCION:    { label: 'ATENCIÓN',    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  SEGUIMIENTO: { label: 'SEGUIMIENTO', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    dot: 'bg-blue-500' },
}

function TabRiesgo({ kpis }: { kpis: KPIs | null }) {
  const ext = kpis?.extended_data as KPIsExtendedData | undefined
  const riesgo = ext?.riesgo ?? []

  if (!riesgo.length) {
    return (
      <EmptyState
        emoji="⚠️"
        title="Datos de riesgo no disponibles"
        desc="Este módulo se completará cuando el análisis de tendencias esté procesado."
      />
    )
  }

  const sorted = [...riesgo].sort((a, b) => {
    const order = { CRITICO: 0, ATENCION: 1, SEGUIMIENTO: 2 }
    return order[a.severidad] - order[b.severidad] || b.impacto_mes - a.impacto_mes
  })

  const criticos = sorted.filter(r => r.severidad === 'CRITICO').length
  const atencion = sorted.filter(r => r.severidad === 'ATENCION').length

  return (
    <div className="space-y-5">

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-red-900/40 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-400 tabular-nums">{criticos}</p>
          <p className="text-slate-400 text-xs mt-1">Críticos</p>
        </div>
        <div className="bg-slate-900 border border-amber-900/40 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-400 tabular-nums">{atencion}</p>
          <p className="text-slate-400 text-xs mt-1">Atención</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-300 tabular-nums">
            {sorted.reduce((acc, r) => acc + r.impacto_mes, 0).toLocaleString('es-ES')}
          </p>
          <p className="text-slate-400 text-xs mt-1">€/mes en riesgo</p>
        </div>
      </div>

      {/* Lista clientes en riesgo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-sm">Clientes en seguimiento</h2>
        </div>
        <div className="divide-y divide-slate-800/50">
          {sorted.map((cli, i) => {
            const cfg = SEVERIDAD_CONFIG[cli.severidad]
            return (
              <div key={`${cli.cliente_codigo}-${i}`} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{cli.cliente_nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="text-red-400 text-xs tabular-nums font-medium">
                        {cli.caida_pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-white text-sm font-semibold tabular-nums">
                    {cli.impacto_mes.toLocaleString('es-ES')} €
                  </p>
                  <p className="text-slate-600 text-xs">impacto/mes</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── FOMO Overlay ─────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<PlanTier, string> = {
  inicio: 'Plan Crecimiento',
  crecimiento: 'Plan Estratégico',
  estrategico: 'Plan Estratégico',
}

const FOMO_PREVIEWS: Record<Tab, string> = {
  drive: '',
  resumen: '',
  margen: 'Accede al detalle completo de margen por categoría con gráficos y tablas comparativas.',
  oportunidades: 'Identifica los clientes exactos con mayor potencial y las acciones comerciales concretas para recuperar margen.',
  comerciales: 'Analiza el rendimiento de cada comercial, identifica quién tiene más potencial sin aprovechar y actúa.',
  riesgo: 'Detecta antes que nadie qué clientes están cayendo y cuánto dinero está en riesgo real de perderse.',
}

function FomoOverlay({
  tab,
  requiredPlan,
  kpis,
}: {
  tab: Tab
  requiredPlan: PlanTier
  kpis: KPIs | null
}) {
  return (
    <div className="relative">
      {/* Preview borrosa */}
      <div className="blur-sm pointer-events-none select-none opacity-40" aria-hidden>
        {tab === 'margen' && <TabMargen kpis={kpis} />}
        {tab === 'oportunidades' && <TabOportunidades kpis={kpis} />}
        {tab === 'comerciales' && <TabComerciales kpis={kpis} config={{} as ClientConfig} />}
        {tab === 'riesgo' && <TabRiesgo kpis={kpis} />}
      </div>

      {/* Lock card encima */}
      <div className="absolute inset-0 flex items-start justify-center pt-20 z-10">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl">
          <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Módulo Premium</h3>
          <p className="text-slate-400 text-sm mb-5 leading-relaxed">{FOMO_PREVIEWS[tab]}</p>
          <p className="text-slate-500 text-xs mb-5">
            Requiere <span className="text-emerald-400 font-semibold">{PLAN_LABELS[requiredPlan]}</span>
          </p>
          <a
            href="mailto:antonio@vysite.es?subject=Ampliar%20plan%20Vysite%20Margen"
            className="block w-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Contactar con Vysite
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers compartidos ──────────────────────────────────────────────────────

function OportunidadesBars({
  oport,
  potencialTotal,
}: {
  oport: KPIs['oportunidades_por_tipo']
  potencialTotal: number
}) {
  const COLORS: Record<string, { label: string; icon: string; color: string; bar: string }> = {
    categoria_perdida:    { label: 'Categorías perdidas',   icon: '📦', color: 'text-orange-400', bar: 'bg-orange-500' },
    mix_suboptimo:        { label: 'Mix subóptimo',          icon: '⚖️', color: 'text-blue-400',   bar: 'bg-blue-500' },
    cliente_caida:        { label: 'Clientes en caída',      icon: '📉', color: 'text-red-400',    bar: 'bg-red-500' },
    producto_no_ofrecido: { label: 'Productos no ofrecidos', icon: '🎁', color: 'text-purple-400', bar: 'bg-purple-500' },
  }
  const total = Object.values(oport).reduce((a, b) => a + b, 0) || 1
  const items = (Object.keys(oport) as (keyof typeof oport)[])
    .map(k => ({ key: k, value: oport[k], ...COLORS[k] }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-white font-semibold text-sm mb-5">Oportunidades por tipo</h2>
      <div className="space-y-4">
        {items.map(item => {
          const pct = Math.round((item.value / total) * 100)
          const eur = potencialTotal > 0 ? Math.round((item.value / total) * potencialTotal) : item.value
          return (
            <div key={item.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-white text-sm font-semibold tabular-nums">
                    {potencialTotal > 0 ? `${eur.toLocaleString('es-ES')} €` : `${item.value}`}
                  </span>
                  <span className="text-slate-500 text-xs ml-1.5">{pct}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${item.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KPICard({
  label, value, sublabel, color,
}: {
  label: string; value: string; sublabel: string; color: 'blue' | 'amber' | 'emerald' | 'slate'
}) {
  const valueColor = color === 'blue' ? 'text-blue-400' : color === 'amber' ? 'text-amber-400' : color === 'emerald' ? 'text-emerald-400' : 'text-slate-300'
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-400 text-xs mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      <p className="text-slate-500 text-xs mt-1 truncate">{sublabel}</p>
    </div>
  )
}

function StatusBanner({
  color, icon, title, desc,
}: {
  color: 'blue' | 'purple' | 'emerald'; icon: string; title: string; desc: string
}) {
  const styles = {
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-300',
    purple:  'bg-purple-500/10 border-purple-500/20 text-purple-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  }
  const subStyles = {
    blue:    'text-blue-400/70',
    purple:  'text-purple-400/70',
    emerald: 'text-emerald-400/70',
  }
  return (
    <div className={`border rounded-xl p-4 flex items-center gap-3 ${styles[color]}`}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className={`text-xs mt-0.5 ${subStyles[color]}`}>{desc}</p>
      </div>
    </div>
  )
}

function EmptyState({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <h2 className="text-white font-semibold text-base mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-xs mx-auto">{desc}</p>
    </div>
  )
}
