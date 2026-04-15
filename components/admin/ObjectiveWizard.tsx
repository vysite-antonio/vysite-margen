'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createObjective, updateObjective } from '@/lib/actions/objectives'
import type {
  ScopeType, MetricType, PeriodType, CommissionType,
  AppliesTo, ObjectiveInput, Objective, CommissionTier,
} from '@/lib/utils/objectives'

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES = ['Limpieza', 'Droguería', 'Alimentación', 'Bebidas', 'Menaje', 'Fresco']

const SCOPE_OPTIONS: { value: ScopeType; label: string; icon: string; desc: string }[] = [
  { value: 'all',      icon: '🌐', label: 'Total facturación',  desc: 'Objetivo sobre toda la venta' },
  { value: 'category', icon: '📦', label: 'Categoría',          desc: 'Una o varias categorías de producto' },
  { value: 'family',   icon: '🏷️', label: 'Familia',            desc: 'Subfamilias dentro de una categoría' },
  { value: 'product',  icon: '🔖', label: 'Producto concreto',  desc: 'SKUs específicos' },
]

const METRIC_OPTIONS: { value: MetricType; label: string; unit: string; icon: string }[] = [
  { value: 'revenue',    label: 'Facturación',   unit: '€',  icon: '💶' },
  { value: 'margin',     label: 'Margen (€)',     unit: '€',  icon: '💰' },
  { value: 'margin_pct', label: 'Margen (%)',     unit: '%',  icon: '📊' },
  { value: 'units',      label: 'Unidades',       unit: 'ud', icon: '📦' },
  { value: 'new_clients',label: 'Clientes nuevos',unit: 'cli',icon: '🤝' },
]

const COMMISSION_OPTIONS: { value: CommissionType; label: string; icon: string; desc: string }[] = [
  { value: 'none',       icon: '—',  label: 'Sin comisión',     desc: 'Solo seguimiento, sin incentivo económico' },
  { value: 'bonus',      icon: '🎯', label: 'Bonus fijo',       desc: 'Importe fijo al alcanzar el 100%' },
  { value: 'percentage', icon: '📈', label: '% sobre conseguido', desc: '% sobre lo vendido del objetivo' },
  { value: 'tiered',     icon: '🏆', label: 'Escalonado',       desc: 'Diferentes premios según % alcanzado' },
]

// Accesos rápidos de período
const QUICK_PERIODS = [
  { label: 'Esta semana',    fn: () => currentWeek() },
  { label: 'Este mes',       fn: () => currentMonth() },
  { label: 'Mes siguiente',  fn: () => nextMonth() },
  { label: 'T1',  fn: () => quarter(1) },
  { label: 'T2',  fn: () => quarter(2) },
  { label: 'T3',  fn: () => quarter(3) },
  { label: 'T4',  fn: () => quarter(4) },
  { label: 'Este año',       fn: () => currentYear() },
]

function iso(d: Date) { return d.toISOString().split('T')[0] }
function currentWeek() {
  const d = new Date(); const day = d.getDay() || 7
  const mon = new Date(d); mon.setDate(d.getDate() - day + 1)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { start: iso(mon), end: iso(sun) }
}
function currentMonth() {
  const d = new Date()
  return { start: iso(new Date(d.getFullYear(), d.getMonth(), 1)), end: iso(new Date(d.getFullYear(), d.getMonth()+1, 0)) }
}
function nextMonth() {
  const d = new Date()
  return { start: iso(new Date(d.getFullYear(), d.getMonth()+1, 1)), end: iso(new Date(d.getFullYear(), d.getMonth()+2, 0)) }
}
function quarter(q: number) {
  const y = new Date().getFullYear()
  const starts = [0,3,6,9]
  const m = starts[q-1]
  return { start: iso(new Date(y,m,1)), end: iso(new Date(y,m+3,0)) }
}
function currentYear() {
  const y = new Date().getFullYear()
  return { start: `${y}-01-01`, end: `${y}-12-31` }
}

function fmtDate(s: string) {
  if (!s) return ''
  return new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Comercial { id: string; name: string; email: string }

interface Props {
  clientId:    string
  comerciales: Comercial[]
  editing?:    Objective
  onClose:     () => void
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function ObjectiveWizard({ clientId, comerciales, editing, onClose }: Props) {
  const router      = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep]   = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [scopeType,   setScopeType]   = useState<ScopeType>(editing?.scope_type ?? 'all')
  const [scopeValues, setScopeValues] = useState<string[]>(editing?.scope_values ?? [])
  const [familyText,  setFamilyText]  = useState(editing?.scope_values?.join(', ') ?? '')
  const [productText, setProductText] = useState(editing?.scope_values?.join(', ') ?? '')

  const [metric,      setMetric]      = useState<MetricType>(editing?.metric ?? 'revenue')
  const [target,      setTarget]      = useState(String(editing?.target_value ?? ''))

  const [periodType,  setPeriodType]  = useState<PeriodType>(editing?.period_type ?? 'monthly')
  const [startDate,   setStartDate]   = useState(editing?.start_date ?? currentMonth().start)
  const [endDate,     setEndDate]     = useState(editing?.end_date   ?? currentMonth().end)
  const [calFocus,    setCalFocus]    = useState<'start' | 'end' | null>(null)

  const [commType,    setCommType]    = useState<CommissionType>(editing?.commission_type ?? 'none')
  const [commBonus,   setCommBonus]   = useState(String(editing?.commission_config?.bonus ?? ''))
  const [commPct,     setCommPct]     = useState(String((editing?.commission_config?.percentage ?? 0) * 100 || ''))
  const [tiers,       setTiers]       = useState<CommissionTier[]>(
    editing?.commission_config?.tiers ?? [
      { threshold_pct: 80,  type: 'bonus', value: 150 },
      { threshold_pct: 100, type: 'bonus', value: 300 },
      { threshold_pct: 120, type: 'bonus', value: 500 },
    ]
  )

  const [appliesTo,    setAppliesTo]    = useState<AppliesTo>(editing?.applies_to ?? 'all')
  const [selectedComs, setSelectedComs] = useState<string[]>(editing?.comercial_ids ?? [])
  const [objName,      setObjName]      = useState(editing?.name ?? '')
  const [objDesc,      setObjDesc]      = useState(editing?.description ?? '')

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  function applyQuick(fn: () => { start: string; end: string }) {
    const { start, end } = fn()
    setStartDate(start); setEndDate(end)
    // Detectar period_type automáticamente
    const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
    if (days <= 7) setPeriodType('custom')
    else if (days <= 31) setPeriodType('monthly')
    else if (days <= 93) setPeriodType('quarterly')
    else if (days <= 366) setPeriodType('annual')
    else setPeriodType('custom')
    setCalFocus(null)
  }

  function handleCalendarClick(dateStr: string) {
    if (!calFocus || calFocus === 'start') {
      setStartDate(dateStr)
      setCalFocus('end')
    } else {
      if (dateStr < startDate) { setStartDate(dateStr); setEndDate(startDate) }
      else setEndDate(dateStr)
      setCalFocus(null)
    }
  }

  function resolvedScopeValues(): string[] {
    if (scopeType === 'all') return []
    if (scopeType === 'category') return scopeValues
    if (scopeType === 'family') return familyText.split(',').map(s => s.trim()).filter(Boolean)
    if (scopeType === 'product') return productText.split(',').map(s => s.trim()).filter(Boolean)
    return []
  }

  function buildInput(): ObjectiveInput {
    const commConfig: ObjectiveInput['commission_config'] = {}
    if (commType === 'bonus')      commConfig.bonus      = parseFloat(commBonus) || 0
    if (commType === 'percentage') commConfig.percentage = (parseFloat(commPct) || 0) / 100
    if (commType === 'tiered')     commConfig.tiers      = tiers

    const name = objName.trim() || autoName()

    return {
      name,
      description:      objDesc,
      scope_type:       scopeType,
      scope_values:     resolvedScopeValues(),
      metric,
      target_value:     parseFloat(target) || 0,
      period_type:      periodType,
      start_date:       startDate,
      end_date:         endDate,
      commission_type:  commType,
      commission_config: commConfig,
      applies_to:       appliesTo,
      comercial_ids:    appliesTo === 'all' ? [] : selectedComs,
    }
  }

  function autoName() {
    const metric = METRIC_OPTIONS.find(m => m.value === (editing?.metric ?? 'revenue'))?.label ?? ''
    const scope  = scopeType === 'all' ? 'Total' : scopeValues[0] ?? resolvedScopeValues()[0] ?? ''
    return `${metric} ${scope} — ${fmtDate(startDate)}`
  }

  function handleSave() {
    const input = buildInput()
    if (!input.target_value) { showToast('Introduce un valor objetivo'); return }
    startTransition(async () => {
      let err: string | null
      if (editing) {
        const r = await updateObjective(editing.id, input); err = r.error
      } else {
        const r = await createObjective(clientId, input); err = r.error
      }
      if (err) { showToast(err); return }
      router.refresh()
      onClose()
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const metricUnit = METRIC_OPTIONS.find(m => m.value === metric)?.unit ?? '€'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Toast */}
        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-950 border border-red-700 text-red-300 text-xs px-4 py-2 rounded-xl z-10">
            ❌ {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-white font-semibold text-sm">
              {editing ? 'Editar objetivo' : 'Nuevo objetivo comercial'}
            </h2>
            <div className="flex gap-1.5 mt-2">
              {[1,2,3,4].map(s => (
                <div key={s} className={`h-1 rounded-full transition-all ${
                  s <= step ? 'bg-emerald-500 w-8' : 'bg-slate-700 w-5'
                }`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none transition-colors">✕</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── Paso 1: Alcance ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <StepLabel n={1} title="Alcance" sub="¿Qué tiene que vender el comercial?" />

              <div className="grid grid-cols-2 gap-2">
                {SCOPE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setScopeType(opt.value); setScopeValues([]) }}
                    className={`text-left p-3 rounded-xl border transition-colors
                      ${scopeType === opt.value
                        ? 'bg-emerald-500/15 border-emerald-600 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                    <span className="text-lg">{opt.icon}</span>
                    <p className="text-xs font-semibold mt-1">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Selector de valores según scope */}
              {scopeType === 'category' && (
                <div>
                  <label className="text-slate-400 text-xs mb-2 block">Selecciona categorías</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat}
                        onClick={() => setScopeValues(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                          ${scopeValues.includes(cat)
                            ? 'bg-emerald-500/20 border-emerald-600 text-emerald-300'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  {scopeValues.length === 0 && (
                    <p className="text-amber-500/80 text-xs mt-2">Selecciona al menos una categoría</p>
                  )}
                </div>
              )}

              {scopeType === 'family' && (
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">
                    Familias de producto
                    <span className="text-slate-600 ml-1">(separadas por comas)</span>
                  </label>
                  <input type="text" value={familyText} onChange={e => setFamilyText(e.target.value)}
                    placeholder="Detergentes, Papel industrial, Desinfectantes…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600" />
                </div>
              )}

              {scopeType === 'product' && (
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">
                    Códigos de producto / SKU
                    <span className="text-slate-600 ml-1">(separados por comas)</span>
                  </label>
                  <input type="text" value={productText} onChange={e => setProductText(e.target.value)}
                    placeholder="REF001, REF002, REF-LIMPIA-5L…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600" />
                  <p className="text-slate-600 text-xs mt-1.5">
                    💡 Próximamente: buscador de SKU directo desde el ERP conectado
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Paso 2: Meta y período ──────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <StepLabel n={2} title="Meta y período" sub="¿Cuánto y cuándo?" />

              {/* Métrica */}
              <div>
                <label className="text-slate-400 text-xs mb-2 block">Qué se mide</label>
                <div className="grid grid-cols-3 gap-2">
                  {METRIC_OPTIONS.map(m => (
                    <button key={m.value} onClick={() => setMetric(m.value)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors
                        ${metric === m.value
                          ? 'bg-emerald-500/15 border-emerald-600 text-emerald-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor objetivo */}
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Valor objetivo</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={target} onChange={e => setTarget(e.target.value)}
                    placeholder="ej. 50000"
                    className="bg-slate-800 border border-slate-700 text-white text-lg font-semibold rounded-lg px-4 py-2.5 w-48 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600 placeholder:font-normal placeholder:text-base" />
                  <span className="text-slate-400 text-sm">{metricUnit}</span>
                </div>
              </div>

              {/* Período */}
              <div>
                <label className="text-slate-400 text-xs mb-2 block">Período</label>

                {/* Accesos rápidos */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {QUICK_PERIODS.map(qp => (
                    <button key={qp.label} onClick={() => applyQuick(qp.fn)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-700 text-slate-400 hover:border-emerald-600 hover:text-emerald-300 transition-colors">
                      {qp.label}
                    </button>
                  ))}
                </div>

                {/* Selector de fechas tipo calendario */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <div className="flex gap-4 mb-3">
                    <DateField
                      label="Inicio"
                      value={startDate}
                      focused={calFocus === 'start'}
                      onClick={() => setCalFocus(calFocus === 'start' ? null : 'start')}
                      onChange={v => { setStartDate(v); if (v > endDate) setEndDate(v) }}
                    />
                    <div className="flex items-end pb-2 text-slate-600">→</div>
                    <DateField
                      label="Fin"
                      value={endDate}
                      focused={calFocus === 'end'}
                      onClick={() => setCalFocus(calFocus === 'end' ? null : 'end')}
                      onChange={v => { setEndDate(v); if (v < startDate) setStartDate(v) }}
                    />
                  </div>

                  {(startDate && endDate) && (
                    <div className="text-slate-500 text-xs">
                      {(() => {
                        const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
                        return `${days} días — ${fmtDate(startDate)} al ${fmtDate(endDate)}`
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 3: Comisión ────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <StepLabel n={3} title="Comisión" sub="¿Qué gana el comercial si lo cumple?" />

              <div className="grid grid-cols-2 gap-2">
                {COMMISSION_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setCommType(opt.value)}
                    className={`text-left p-3 rounded-xl border transition-colors
                      ${commType === opt.value
                        ? 'bg-emerald-500/15 border-emerald-600 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                    <span className="text-lg">{opt.icon}</span>
                    <p className="text-xs font-semibold mt-1">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {commType === 'bonus' && (
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">Bonus al alcanzar el 100%</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={commBonus} onChange={e => setCommBonus(e.target.value)}
                      placeholder="ej. 300"
                      className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-36 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600" />
                    <span className="text-slate-400 text-sm">€</span>
                  </div>
                </div>
              )}

              {commType === 'percentage' && (
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">% sobre lo conseguido del objetivo</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="100" step="0.1" value={commPct} onChange={e => setCommPct(e.target.value)}
                      placeholder="ej. 2"
                      className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-28 focus:outline-none focus:border-emerald-500" />
                    <span className="text-slate-400 text-sm">%</span>
                    <span className="text-slate-600 text-xs">sobre {parseFloat(target||'0').toLocaleString('es-ES')} {metricUnit}</span>
                  </div>
                </div>
              )}

              {commType === 'tiered' && (
                <div className="space-y-3">
                  <label className="text-slate-400 text-xs block">Tramos por porcentaje de cumplimiento</label>
                  {tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-500 text-xs w-12 shrink-0">Al</span>
                      <input type="number" min="0" value={tier.threshold_pct}
                        onChange={e => { const t=[...tiers]; t[i]={...t[i],threshold_pct:+e.target.value}; setTiers(t) }}
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 w-16 focus:outline-none focus:border-emerald-500" />
                      <span className="text-slate-500 text-xs">% →</span>
                      <select value={tier.type}
                        onChange={e => { const t=[...tiers]; t[i]={...t[i],type:e.target.value as 'bonus'|'percentage'}; setTiers(t) }}
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500">
                        <option value="bonus">Bonus €</option>
                        <option value="percentage">% sobre conseguido</option>
                      </select>
                      <input type="number" min="0" value={tier.value}
                        onChange={e => { const t=[...tiers]; t[i]={...t[i],value:+e.target.value}; setTiers(t) }}
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 w-20 focus:outline-none focus:border-emerald-500" />
                      <span className="text-slate-500 text-xs">{tier.type==='bonus'?'€':'%'}</span>
                      {tiers.length > 1 && (
                        <button onClick={() => setTiers(tiers.filter((_,j) => j!==i))} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setTiers([...tiers, { threshold_pct: 110, type: 'bonus', value: 0 }])}
                    className="text-emerald-400 hover:text-emerald-300 text-xs transition-colors">
                    + Añadir tramo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Paso 4: Asignación y resumen ────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              <StepLabel n={4} title="Asignación y resumen" sub="¿A quién aplica este objetivo?" />

              {/* Asignación */}
              <div className="flex gap-2">
                {(['all','selected'] as AppliesTo[]).map(opt => (
                  <button key={opt} onClick={() => setAppliesTo(opt)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors
                      ${appliesTo === opt
                        ? 'bg-emerald-500/15 border-emerald-600 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                    {opt === 'all' ? '👥 Todo el equipo' : '👤 Comerciales seleccionados'}
                  </button>
                ))}
              </div>

              {appliesTo === 'selected' && (
                <div>
                  <label className="text-slate-400 text-xs mb-2 block">Selecciona comerciales</label>
                  {comerciales.length > 0 ? (
                    <div className="space-y-1.5">
                      {comerciales.map(c => (
                        <label key={c.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                            ${selectedComs.includes(c.id)
                              ? 'bg-emerald-500/10 border-emerald-700/60'
                              : 'border-slate-800 hover:border-slate-700'}`}>
                          <input type="checkbox" checked={selectedComs.includes(c.id)}
                            onChange={e => setSelectedComs(e.target.checked
                              ? [...selectedComs, c.id]
                              : selectedComs.filter(id => id !== c.id))}
                            className="accent-emerald-500" />
                          <div>
                            <p className="text-white text-sm font-medium">{c.name}</p>
                            <p className="text-slate-500 text-xs">{c.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs">No hay comerciales configurados para este cliente.</p>
                  )}
                </div>
              )}

              {/* Nombre del objetivo */}
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">
                  Nombre del objetivo
                  <button onClick={() => setObjName(autoName())} className="text-emerald-500 hover:text-emerald-400 ml-2 text-[11px] transition-colors">
                    (generar automático)
                  </button>
                </label>
                <input type="text" value={objName} onChange={e => setObjName(e.target.value)}
                  placeholder={autoName()}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600" />
              </div>

              {/* Resumen */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">Resumen del objetivo</p>
                <SummaryRow label="Alcance"  value={scopeType === 'all' ? 'Toda la facturación' : resolvedScopeValues().join(', ') || '—'} />
                <SummaryRow label="Métrica"  value={`${METRIC_OPTIONS.find(m=>m.value===metric)?.label} ≥ ${parseFloat(target||'0').toLocaleString('es-ES')} ${metricUnit}`} />
                <SummaryRow label="Período"  value={`${fmtDate(startDate)} → ${fmtDate(endDate)}`} />
                <SummaryRow label="Comisión" value={
                  commType === 'none'       ? 'Sin comisión' :
                  commType === 'bonus'      ? `Bonus ${commBonus} € al 100%` :
                  commType === 'percentage' ? `${commPct}% sobre conseguido` :
                  `Escalonado (${tiers.length} tramos)`
                } />
                <SummaryRow label="Aplica a" value={
                  appliesTo === 'all'
                    ? 'Todo el equipo comercial'
                    : `${selectedComs.length} comercial${selectedComs.length !== 1 ? 'es' : ''} seleccionado${selectedComs.length !== 1 ? 's' : ''}`
                } />
              </div>
            </div>
          )}
        </div>

        {/* Footer — navegación */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s-1) : onClose()}
            className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            {step > 1 ? '← Anterior' : 'Cancelar'}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-slate-600 text-xs">Paso {step} de 4</span>
            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 1 && scopeType !== 'all' && resolvedScopeValues().length === 0) {
                    showToast('Selecciona al menos un valor para el alcance'); return
                  }
                  setStep(s => s+1)
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isPending}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear objetivo ✓'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StepLabel({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-1">
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-slate-500 text-xs w-20 shrink-0">{label}</span>
      <span className="text-slate-200 text-xs flex-1">{value}</span>
    </div>
  )
}

function DateField({ label, value, focused, onClick, onChange }: {
  label: string; value: string; focused: boolean
  onClick: () => void; onChange: (v: string) => void
}) {
  return (
    <div className="flex-1">
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <div
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors
          ${focused ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-600 hover:border-slate-500'}`}
      >
        <span className="text-slate-400 text-xs">📅</span>
        <input
          type="date"
          value={value}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange(e.target.value)}
          className="bg-transparent text-white text-xs focus:outline-none w-full cursor-pointer"
        />
      </div>
    </div>
  )
}
