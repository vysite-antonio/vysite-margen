'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding, skipOnboarding } from '@/lib/actions/onboarding'

// ─── Categorías con iconos y descripción ─────────────────────────────────────

const CATEGORIES = [
  { key: 'Limpieza',     label: 'Limpieza',     icon: '🧹', hint: 'Productos de limpieza profesional' },
  { key: 'Drogueria',    label: 'Droguería',    icon: '🧴', hint: 'Droguería y higiene' },
  { key: 'Menaje',       label: 'Menaje',       icon: '🍽️', hint: 'Menaje, vajilla y cocina' },
  { key: 'Alimentacion', label: 'Alimentación', icon: '🥫', hint: 'Alimentación seca y conservas' },
  { key: 'Bebidas',      label: 'Bebidas',      icon: '🥤', hint: 'Bebidas y refrescos' },
  { key: 'Fresco',       label: 'Fresco',       icon: '🥬', hint: 'Frescos y perecederos' },
  { key: 'Otros',        label: 'Otros',        icon: '📦', hint: 'Otras categorías' },
] as const

type CategoryKey = typeof CATEGORIES[number]['key']

const DEFAULT_MARGINS: Record<CategoryKey, number> = {
  Limpieza:     35,
  Drogueria:    32,
  Menaje:       28,
  Alimentacion: 22,
  Bebidas:      18,
  Fresco:       15,
  Otros:        20,
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  companyName: string
  currentMargins?: Record<string, number>
}

export default function OnboardingWizard({ companyName, currentMargins }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [cycleLabel, setCycleLabel] = useState<string | null>(null)

  // Inicializar márgenes: si ya hay config, convertir de decimal a %
  const initMargins = (): Record<CategoryKey, number> => {
    const result = {} as Record<CategoryKey, number>
    for (const cat of CATEGORIES) {
      const stored = currentMargins?.[cat.key]
      result[cat.key] = stored != null
        ? stored <= 1 ? Math.round(stored * 100) : Math.round(stored)
        : DEFAULT_MARGINS[cat.key]
    }
    return result
  }

  const [margins, setMargins] = useState(initMargins)

  const setMargin = (key: CategoryKey, value: number) => {
    setMargins(prev => ({ ...prev, [key]: Math.min(99, Math.max(0, value)) }))
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleComplete = async () => {
    setLoading(true)
    const { error, periodLabel } = await completeOnboarding(margins as unknown as Parameters<typeof completeOnboarding>[0])
    setLoading(false)
    if (!error) {
      setCycleLabel(periodLabel ?? null)
      setStep(3)
    }
  }

  const handleSkip = async () => {
    await skipOnboarding()
    router.refresh()
  }

  const handleFinish = () => {
    router.refresh()
  }

  // ── Progress indicator ───────────────────────────────────────────────────────

  const StepDot = ({ n }: { n: number }) => (
    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
      n === step ? 'bg-emerald-400 scale-125' :
      n < step  ? 'bg-emerald-600' : 'bg-slate-700'
    }`} />
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">V</span>
              </div>
              <span className="text-white font-semibold text-sm">Vysite Margen</span>
            </div>
            <div className="flex items-center gap-1.5">
              <StepDot n={1} /><StepDot n={2} /><StepDot n={3} />
            </div>
          </div>
          <p className="text-slate-400 text-xs">
            Paso {step} de 3 — {step === 1 ? 'Configuración inicial' : step === 2 ? 'Primer análisis' : 'Listo'}
          </p>
        </div>

        {/* ── PASO 1: Márgenes objetivo ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="px-7 py-6 space-y-5">
            <div>
              <h2 className="text-white font-semibold text-lg">Bienvenido, {companyName} 👋</h2>
              <p className="text-slate-400 text-sm mt-1">
                Configura los márgenes mínimos que quieres alcanzar en cada categoría.
                Estos datos se usan para detectar oportunidades de mejora.
              </p>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {CATEGORIES.map(cat => (
                <div key={cat.key} className="flex items-center gap-3">
                  <span className="text-base w-6 text-center shrink-0">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium leading-none">{cat.label}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{cat.hint}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={margins[cat.key]}
                      onChange={e => setMargin(cat.key, parseFloat(e.target.value) || 0)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm text-right focus:outline-none focus:border-emerald-500 tabular-nums"
                    />
                    <span className="text-slate-500 text-sm">%</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-slate-600 text-xs">
              Puedes cambiar estos valores en cualquier momento desde tu panel de configuración.
            </p>
          </div>
        )}

        {/* ── PASO 2: Solicitar primer ciclo ────────────────────────────────── */}
        {step === 2 && (
          <div className="px-7 py-6 space-y-5">
            <div>
              <h2 className="text-white font-semibold text-lg">Márgenes guardados ✓</h2>
              <p className="text-slate-400 text-sm mt-1">
                Ahora vamos a poner en marcha tu primer análisis de margen.
              </p>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-white text-sm font-medium">¿Cómo funciona?</p>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Cada ciclo analiza tus ventas de un período. Subes un CSV exportado de tu ERP
                    y en minutos tendrás un informe de márgenes, oportunidades y riesgo de clientes.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="text-white text-sm font-medium">Primer ciclo automático</p>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Al confirmar crearemos un ciclo para el período actual. Solo tendrás que
                    subir el CSV cuando lo tengas disponible.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 3: Confirmación ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="px-7 py-6 space-y-5">
            <div className="text-center py-2">
              <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎉</span>
              </div>
              <h2 className="text-white font-semibold text-lg">¡Todo listo!</h2>
              <p className="text-slate-400 text-sm mt-2">
                Tu cuenta está configurada y tu primer ciclo de análisis está en marcha.
              </p>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-4 py-3 space-y-2">
              {cycleLabel && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                  <p className="text-emerald-300 text-xs">Ciclo creado: <span className="font-medium">{cycleLabel}</span></p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                <p className="text-emerald-300 text-xs">Márgenes objetivo configurados</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-600 rounded-full"></span>
                <p className="text-slate-400 text-xs">Pendiente: subir CSV del ERP</p>
              </div>
            </div>

            <p className="text-slate-500 text-xs text-center">
              Accede a la pestaña <span className="text-slate-300">Archivos</span> para subir tu CSV cuando lo tengas.
            </p>
          </div>
        )}

        {/* Footer con botones */}
        <div className="px-7 pb-7 pt-2 flex items-center justify-between gap-3">
          {step < 3 && (
            <button
              onClick={handleSkip}
              className="text-slate-500 hover:text-slate-400 text-sm transition-colors"
            >
              Omitir configuración
            </button>
          )}

          <div className={`flex items-center gap-3 ${step < 3 ? 'ml-auto' : 'w-full justify-center'}`}>
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Guardar y continuar →
              </button>
            )}
            {step === 2 && (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
                >
                  ← Atrás
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {loading ? 'Configurando...' : 'Crear primer ciclo →'}
                </button>
              </>
            )}
            {step === 3 && (
              <button
                onClick={handleFinish}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Ir al dashboard
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
