'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { KPIs } from '@/types'

interface Props { cycleId: string; clientId: string; existingKpis: KPIs | null }

export default function UpdateKPIsForm({ cycleId, clientId, existingKpis }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    total_oportunidades: existingKpis?.total_oportunidades ?? 0,
    potencial_mensual: existingKpis?.potencial_mensual ?? 0,
    facturacion_total: existingKpis?.facturacion_total ?? 0,
    margen_total: existingKpis?.margen_total ?? 0,
    clientes_activos: existingKpis?.clientes_activos ?? 0,
    top_categoria: existingKpis?.top_categoria ?? '',
    categoria_mayor_potencial: existingKpis?.categoria_mayor_potencial ?? '',
    cat_perdida: existingKpis?.oportunidades_por_tipo?.categoria_perdida ?? 0,
    mix_suboptimo: existingKpis?.oportunidades_por_tipo?.mix_suboptimo ?? 0,
    cliente_caida: existingKpis?.oportunidades_por_tipo?.cliente_caida ?? 0,
    producto_no_ofrecido: existingKpis?.oportunidades_por_tipo?.producto_no_ofrecido ?? 0,
  })

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    const potencial_anual = form.potencial_mensual * 12
    const margen_porcentaje = form.facturacion_total > 0 ? (form.margen_total / form.facturacion_total) * 100 : 0
    const payload = {
      cycle_id: cycleId, client_id: clientId,
      total_oportunidades: form.total_oportunidades,
      potencial_mensual: form.potencial_mensual, potencial_anual,
      facturacion_total: form.facturacion_total, margen_total: form.margen_total,
      margen_porcentaje: Math.round(margen_porcentaje * 100) / 100,
      clientes_activos: form.clientes_activos,
      top_categoria: form.top_categoria, categoria_mayor_potencial: form.categoria_mayor_potencial,
      oportunidades_por_tipo: { categoria_perdida: form.cat_perdida, mix_suboptimo: form.mix_suboptimo, cliente_caida: form.cliente_caida, producto_no_ofrecido: form.producto_no_ofrecido },
      source: 'manual',
    }
    try {
      if (existingKpis) { const { error } = await supabase.from('kpis').update(payload).eq('id', existingKpis.id); if (error) throw error }
      else { const { error } = await supabase.from('kpis').insert(payload); if (error) throw error }
      await supabase.from('system_logs').insert({ action: 'kpis_actualizados', client_id: clientId, details: { cycle_id: cycleId, potencial_mensual: form.potencial_mensual } })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  const numField = (label: string, key: keyof typeof form) => (
    <div key={key}>
      <label className="block text-slate-400 text-xs mb-1.5">{label}</label>
      <input type="number" value={form[key] as number}
        onChange={e => setForm(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"/>
    </div>
  )

  return (
    <div className="bg-slate-800/50 rounded-xl p-5 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {numField('Oportunidades detectadas', 'total_oportunidades')}
        {numField('Potencial mensual (EUR)', 'potencial_mensual')}
        {numField('Facturacion total (EUR)', 'facturacion_total')}
        {numField('Margen total (EUR)', 'margen_total')}
        {numField('Clientes activos', 'clientes_activos')}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Top categoria (margen)</label>
          <input type="text" value={form.top_categoria} onChange={e => setForm(p => ({...p, top_categoria: e.target.value}))}
            placeholder="ej: Limpieza" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"/>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Categoria mayor potencial</label>
          <input type="text" value={form.categoria_mayor_potencial} onChange={e => setForm(p => ({...p, categoria_mayor_potencial: e.target.value}))}
            placeholder="ej: Drogueria" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"/>
        </div>
      </div>
      <div>
        <p className="text-slate-400 text-xs mb-3">Desglose por tipo de oportunidad</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {numField('Categoria perdida', 'cat_perdida')}
          {numField('Mix suboptimo', 'mix_suboptimo')}
          {numField('Cliente en caida', 'cliente_caida')}
          {numField('Producto no ofrecido', 'producto_no_ofrecido')}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white disabled:text-slate-500 px-5 py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? 'Guardando...' : existingKpis ? 'Actualizar KPIs' : 'Guardar KPIs'}
        </button>
        {saved && <span className="text-emerald-400 text-sm">Guardado</span>}
        {error && <span className="text-red-400 text-sm">{error}</span>}
        {form.facturacion_total > 0 && (
          <span className="text-slate-500 text-xs ml-auto">
            Margen: {((form.margen_total / form.facturacion_total) * 100).toFixed(1)}% · Potencial anual: {(form.potencial_mensual * 12).toLocaleString('es-ES')} EUR
          </span>
        )}
      </div>
    </div>
  )
}

