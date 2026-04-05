'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  upsertIncentiveRule,
  deleteIncentiveRule,
  upsertCommissionConfig,
} from '@/lib/actions/incentives'
import type { IncentiveRule, CommissionConfig, CommissionTier, IncentiveType, TierName } from '@/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES = ['Limpieza', 'Droguería', 'Alimentación', 'Bebidas', 'Menaje', 'Fresco']

const TIER_LABELS: Record<TierName, string> = {
  bronce: '🥉 Bronce',
  plata:  '🥈 Plata',
  oro:    '🥇 Oro',
}
const TIER_COLORS: Record<TierName, string> = {
  bronce: 'text-orange-400 bg-orange-950/40 border-orange-800/50',
  plata:  'text-slate-300  bg-slate-800/60  border-slate-600/50',
  oro:    'text-yellow-400 bg-yellow-950/40 border-yellow-800/50',
}
const TYPE_LABELS: Record<IncentiveType, string> = {
  bonus:      '+ Bonus fijo',
  percentage: '+ % extra sobre categoría',
  multiplier: '× Multiplicador global',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string
  rules: IncentiveRule[]
  commissionConfig: CommissionConfig | null
  onRefresh: () => void
}

// ─── Formulario de regla ──────────────────────────────────────────────────────

interface RuleFormState {
  id?: string
  category: string
  threshold_amount: string
  incentive_type: IncentiveType
  incentive_value: string
  tier_name: TierName
  active: boolean
}

const BLANK_RULE: RuleFormState = {
  category:         'Limpieza',
  threshold_amount: '',
  incentive_type:   'bonus',
  incentive_value:  '',
  tier_name:        'bronce',
  active:           true,
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IncentiveConfig({ clientId, rules, commissionConfig, onRefresh }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editRule, setEditRule] = useState<RuleFormState | null>(null)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [configTab, setConfigTab] = useState<'rules' | 'commission'>('rules')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Config comisión base ─────────────────────────────────────────────────
  const [baseType, setBaseType] = useState<'flat' | 'tiered'>(commissionConfig?.base_type ?? 'flat')
  const [basePct, setBasePct] = useState(String((commissionConfig?.base_percentage ?? 0.05) * 100))
  const [tiers, setTiers] = useState<CommissionTier[]>(
    commissionConfig?.tiers?.length ? commissionConfig.tiers : [{ up_to: 10000, percentage: 0.04 }, { up_to: null, percentage: 0.06 }]
  )

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Guardar regla ────────────────────────────────────────────────────────
  function handleSaveRule(form: RuleFormState) {
    const threshold = parseFloat(form.threshold_amount)
    const value     = parseFloat(form.incentive_value)
    if (isNaN(threshold) || isNaN(value) || threshold <= 0) {
      showToast('Revisa los valores del formulario', false)
      return
    }
    startTransition(async () => {
      const { error } = await upsertIncentiveRule(clientId, {
        ...(form.id ? { id: form.id } : {}),
        category:         form.category,
        threshold_amount: threshold,
        incentive_type:   form.incentive_type,
        incentive_value:  value,
        tier_name:        form.tier_name,
        active:           form.active,
      })
      if (error) { showToast(error, false); return }
      showToast('Regla guardada')
      setShowRuleForm(false)
      setEditRule(null)
      onRefresh()
      router.refresh()
    })
  }

  // ── Eliminar regla ───────────────────────────────────────────────────────
  function handleDeleteRule(ruleId: string) {
    startTransition(async () => {
      const { error } = await deleteIncentiveRule(ruleId)
      if (error) { showToast(error, false); return }
      showToast('Regla eliminada')
      onRefresh()
      router.refresh()
    })
  }

  // ── Guardar config comisión ──────────────────────────────────────────────
  function handleSaveCommission() {
    const base = parseFloat(basePct) / 100
    if (isNaN(base) || base <= 0 || base > 1) {
      showToast('Porcentaje base inválido', false)
      return
    }
    if (baseType === 'tiered' && tiers.some(t => isNaN(t.percentage) || t.percentage <= 0)) {
      showToast('Revisa los porcentajes de tramos', false)
      return
    }
    startTransition(async () => {
      const { error } = await upsertCommissionConfig(clientId, {
        base_type:       baseType,
        base_percentage: base,
        tiers,
      })
      if (error) { showToast(error, false); return }
      showToast('Configuración guardada')
      onRefresh()
      router.refresh()
    })
  }

  // Agrupar reglas por categoría
  const rulesByCategory: Record<string, IncentiveRule[]> = {}
  for (const rule of rules) {
    if (!rulesByCategory[rule.category]) rulesByCategory[rule.category] = []
    rulesByCategory[rule.category].push(rule)
  }

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl transition-all
          ${toast.ok
            ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
            : 'bg-red-950 border-red-700 text-red-300'}`}>
          {toast.ok ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">⚙️ Configuración de incentivos</h2>
          <p className="text-slate-500 text-xs mt-0.5">Define las reglas de comisión para tu equipo comercial</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit">
        {(['rules', 'commission'] as const).map(t => (
          <button
            key={t}
            onClick={() => setConfigTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${configTab === t
                ? 'bg-emerald-500 text-white'
                : 'text-slate-400 hover:text-slate-200'}`}
          >
            {t === 'rules' ? '🏅 Reglas por categoría' : '💰 Comisión base'}
          </button>
        ))}
      </div>

      {/* ── Panel: Reglas ──────────────────────────────────────────────────── */}
      {configTab === 'rules' && (
        <div className="space-y-4">

          {/* Botón añadir */}
          {!showRuleForm && (
            <button
              onClick={() => { setEditRule({ ...BLANK_RULE }); setShowRuleForm(true) }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <span>+</span>
              <span>Nueva regla</span>
            </button>
          )}

          {/* Formulario de regla */}
          {showRuleForm && editRule && (
            <RuleForm
              form={editRule}
              onChange={setEditRule}
              onSave={handleSaveRule}
              onCancel={() => { setShowRuleForm(false); setEditRule(null) }}
              isPending={isPending}
            />
          )}

          {/* Lista de reglas por categoría */}
          {CATEGORIES.map(cat => {
            const catRules = (rulesByCategory[cat] ?? []).sort((a, b) => a.threshold_amount - b.threshold_amount)
            return (
              <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  <h3 className="text-white text-sm font-medium">{cat}</h3>
                  <span className="text-slate-600 text-xs">{catRules.length} regla{catRules.length !== 1 ? 's' : ''}</span>
                </div>
                {catRules.length === 0 ? (
                  <p className="text-slate-600 text-xs px-4 py-3">Sin reglas configuradas</p>
                ) : (
                  <div className="divide-y divide-slate-800/60">
                    {catRules.map(rule => (
                      <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
                        {/* Tier badge */}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${TIER_COLORS[rule.tier_name]}`}>
                          {TIER_LABELS[rule.tier_name]}
                        </span>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-xs">
                            Si ventas ≥ <span className="text-emerald-400 font-medium">{eur(rule.threshold_amount)}</span>
                            {' → '}
                            <span className="text-slate-300">{formatIncentive(rule)}</span>
                          </p>
                        </div>
                        {/* Acciones */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditRule({
                                id:               rule.id,
                                category:         rule.category,
                                threshold_amount: String(rule.threshold_amount),
                                incentive_type:   rule.incentive_type,
                                incentive_value:  String(
                                  rule.incentive_type === 'percentage' || rule.incentive_type === 'multiplier'
                                    ? rule.incentive_value * 100
                                    : rule.incentive_value
                                ),
                                tier_name: rule.tier_name,
                                active:    rule.active,
                              })
                              setShowRuleForm(true)
                            }}
                            className="text-slate-500 hover:text-slate-200 text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            disabled={isPending}
                            className="text-slate-500 hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Panel: Comisión base ───────────────────────────────────────────── */}
      {configTab === 'commission' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">

            {/* Tipo base */}
            <div>
              <label className="text-slate-400 text-xs mb-2 block">Tipo de comisión base</label>
              <div className="flex gap-2">
                {(['flat', 'tiered'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setBaseType(t)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors
                      ${baseType === t
                        ? 'bg-emerald-500/20 border-emerald-600 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
                  >
                    {t === 'flat' ? '📊 Porcentaje fijo' : '📈 Tramos escalonados'}
                  </button>
                ))}
              </div>
            </div>

            {/* Flat */}
            {baseType === 'flat' && (
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">% sobre facturación total</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0" max="100" step="0.1"
                    value={basePct}
                    onChange={e => setBasePct(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-28 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-400 text-sm">%</span>
                  <span className="text-slate-600 text-xs">
                    (ej: 5 → 5% de toda la facturación)
                  </span>
                </div>
              </div>
            )}

            {/* Tiered */}
            {baseType === 'tiered' && (
              <div>
                <label className="text-slate-400 text-xs mb-2 block">Tramos escalonados</label>
                <div className="space-y-2 mb-3">
                  {tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-500 text-xs w-16 shrink-0">
                        {i === 0 ? '0 €' : `>${eur(tiers[i-1].up_to ?? 0)}`}
                      </span>
                      <span className="text-slate-600 text-xs">hasta</span>
                      {tier.up_to !== null ? (
                        <input
                          type="number" min="0" step="1000"
                          value={tier.up_to}
                          onChange={e => {
                            const next = [...tiers]
                            next[i] = { ...next[i], up_to: parseFloat(e.target.value) || 0 }
                            setTiers(next)
                          }}
                          className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 w-28 focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <span className="text-slate-400 text-xs px-2">∞ (sin límite)</span>
                      )}
                      <span className="text-slate-600 text-xs">→</span>
                      <input
                        type="number" min="0" max="100" step="0.1"
                        value={(tier.percentage * 100).toFixed(1)}
                        onChange={e => {
                          const next = [...tiers]
                          next[i] = { ...next[i], percentage: (parseFloat(e.target.value) || 0) / 100 }
                          setTiers(next)
                        }}
                        className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 w-20 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-slate-400 text-xs">%</span>
                      {tiers.length > 1 && (
                        <button
                          onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                          className="text-slate-600 hover:text-red-400 text-xs transition-colors"
                        >✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setTiers([...tiers.slice(0, -1), { ...tiers[tiers.length-1], up_to: (tiers[tiers.length-1].up_to ?? 50000) + 10000 }, { up_to: null, percentage: 0.06 }])}
                  className="text-emerald-400 hover:text-emerald-300 text-xs transition-colors"
                >
                  + Añadir tramo
                </button>
              </div>
            )}

            <button
              onClick={handleSaveCommission}
              disabled={isPending}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {isPending ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>

          {/* Vista previa */}
          {commissionConfig && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs mb-2">Configuración activa</p>
              <p className="text-slate-300 text-xs">
                {commissionConfig.base_type === 'flat'
                  ? `Porcentaje fijo: ${(commissionConfig.base_percentage * 100).toFixed(1)}%`
                  : `Tramos escalonados: ${commissionConfig.tiers.length} tramos`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Formulario de regla ──────────────────────────────────────────────────────

function RuleForm({
  form,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  form: RuleFormState
  onChange: (f: RuleFormState) => void
  onSave: (f: RuleFormState) => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="bg-slate-900 border border-emerald-800/50 rounded-xl p-5 space-y-4">
      <h3 className="text-white text-sm font-semibold">{form.id ? 'Editar regla' : 'Nueva regla'}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Categoría */}
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Categoría</label>
          <select
            value={form.category}
            onChange={e => onChange({ ...form, category: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Tier */}
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Nivel</label>
          <select
            value={form.tier_name}
            onChange={e => onChange({ ...form, tier_name: e.target.value as TierName })}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {(Object.keys(TIER_LABELS) as TierName[]).map(t => (
              <option key={t} value={t}>{TIER_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Umbral */}
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Ventas mínimas (€)</label>
          <input
            type="number" min="0" step="100"
            placeholder="ej: 5000"
            value={form.threshold_amount}
            onChange={e => onChange({ ...form, threshold_amount: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
          />
        </div>

        {/* Tipo de incentivo */}
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Tipo de incentivo</label>
          <select
            value={form.incentive_type}
            onChange={e => onChange({ ...form, incentive_type: e.target.value as IncentiveType })}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {(Object.keys(TYPE_LABELS) as IncentiveType[]).map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Valor */}
        <div className="sm:col-span-2">
          <label className="text-slate-400 text-xs mb-1.5 block">
            {form.incentive_type === 'bonus'
              ? 'Importe del bonus (€)'
              : form.incentive_type === 'percentage'
              ? '% adicional sobre ventas de categoría'
              : '% multiplicador base (ej: 120 = ×1.2)'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" step={form.incentive_type === 'bonus' ? '50' : '0.1'}
              placeholder={form.incentive_type === 'bonus' ? 'ej: 200' : 'ej: 5'}
              value={form.incentive_value}
              onChange={e => onChange({ ...form, incentive_value: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 w-36 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
            />
            <span className="text-slate-400 text-sm">
              {form.incentive_type === 'bonus' ? '€' : '%'}
            </span>
          </div>
          {form.incentive_type !== 'bonus' && (
            <p className="text-slate-600 text-xs mt-1">
              {form.incentive_type === 'percentage'
                ? 'Se añade a la comisión base. Ej: 5% sobre 10.000€ = 500€ extra.'
                : 'Multiplica la comisión base. Ej: 120% → la comisión total se multiplica por 1.2.'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={isPending}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          {isPending ? 'Guardando…' : 'Guardar regla'}
        </button>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-200 text-xs px-4 py-2.5 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Helpers de presentación ──────────────────────────────────────────────────

function formatIncentive(rule: IncentiveRule): string {
  if (rule.incentive_type === 'bonus') {
    return `Bonus ${eur(rule.incentive_value)}`
  }
  if (rule.incentive_type === 'percentage') {
    return `+${(rule.incentive_value * 100).toFixed(1)}% comisión extra`
  }
  return `×${rule.incentive_value} multiplicador base`
}
