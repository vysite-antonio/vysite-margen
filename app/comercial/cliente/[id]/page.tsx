import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CYCLE_STATUS_LABELS, CYCLE_STATUS_COLORS, CycleStatus } from '@/types'
import type { KPIsExtendedData } from '@/types'
import Link from 'next/link'
import MargenChart from '@/components/client/charts/MargenChart'
import ComercialesChart from '@/components/client/charts/ComercialesChart'
import TendenciaChart from '@/components/client/charts/TendenciaChart'

export default async function ComercialClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'comercial') redirect('/dashboard')

  // Verificar que el comercial tiene acceso a este cliente
  const { data: assignment } = await supabase
    .from('comercial_clients')
    .select('id')
    .eq('comercial_user_id', user.id)
    .eq('client_id', clientId)
    .single()

  if (!assignment) notFound()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (!client) notFound()

  const { data: cycles } = await supabase
    .from('analysis_cycles')
    .select('*, kpis(*)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)

  const latestCycle = cycles?.[0] ?? null
  const kpis = latestCycle?.kpis?.[0] ?? null
  const ext = kpis?.extended_data as KPIsExtendedData | undefined

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/comercial" className="text-slate-400 hover:text-white text-sm transition-colors">← Mis clientes</Link>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-medium">{client.company_name}</span>
          {latestCycle && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ml-auto ${CYCLE_STATUS_COLORS[latestCycle.status as CycleStatus]}`}>
              {CYCLE_STATUS_LABELS[latestCycle.status as CycleStatus]}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Info del cliente */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-white font-semibold">{client.company_name}</p>
          <p className="text-slate-400 text-sm mt-0.5">{client.contact_name} · {client.contact_email}</p>
          <div className="flex gap-2 mt-3">
            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">Plan: {client.plan ?? 'inicio'}</span>
            {latestCycle && (
              <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">
                {new Date(latestCycle.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — {new Date(latestCycle.period_end).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {!kpis && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <p className="text-slate-400 text-sm">No hay datos de análisis disponibles para este cliente.</p>
          </div>
        )}

        {kpis && (
          <>
            {/* KPIs Hero */}
            <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border border-emerald-900/40 rounded-2xl p-6">
              <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-2">Potencial recuperable</p>
              <div className="flex items-end gap-3 mb-1.5">
                <span className="text-5xl font-bold text-white tabular-nums leading-none">
                  {Number(kpis.potencial_mensual).toLocaleString('es-ES')}
                </span>
                <span className="text-emerald-400 text-lg font-semibold mb-0.5">EUR/mes</span>
              </div>
              <p className="text-slate-400 text-sm">
                Proyección anual: <span className="text-white font-semibold">{Number(kpis.potencial_anual).toLocaleString('es-ES')} EUR</span>
              </p>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Oportunidades', value: kpis.total_oportunidades?.toString() ?? '0', sub: 'identificadas' },
                { label: 'Facturación', value: `${(Number(kpis.facturacion_total) / 1000).toFixed(0)}K €`, sub: 'período analizado' },
                { label: 'Margen actual', value: `${Number(kpis.margen_porcentaje).toFixed(1)}%`, sub: 'sobre facturación' },
                { label: 'Clientes activos', value: kpis.clientes_activos?.toString() ?? '0', sub: 'en cartera' },
              ].map((k, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-500 text-xs mb-1.5">{k.label}</p>
                  <p className="text-white font-bold text-xl tabular-nums">{k.value}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            {ext?.margen_por_categoria && ext.margen_por_categoria.length > 0 && (
              <MargenChart data={ext.margen_por_categoria} />
            )}
            {ext?.comerciales && ext.comerciales.length > 0 && (
              <ComercialesChart comerciales={ext.comerciales} pipeline={ext.pipeline ?? 'lineas_venta'} />
            )}
            {ext?.tendencia_mensual && ext.tendencia_mensual.length > 1 && (
              <TendenciaChart data={ext.tendencia_mensual} label="Evolución mensual de facturación" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
