'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PlanTier } from '@/types'

interface PlanInfo {
  label: string
  price: number
  priceLabel: string
  features: string[]
}

interface Props {
  plans: Record<string, PlanInfo>
  isLoggedIn: boolean
  currentPlan: PlanTier
}

const PLAN_ORDER: Record<string, number> = { inicio: 0, crecimiento: 1, estrategico: 2 }

export default function PricingCards({ plans, isLoggedIn, currentPlan }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const handleSelectPlan = (planKey: string) => {
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    if (planKey === 'inicio') return  // downgrade vía portal
    setLoadingPlan(planKey)
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planKey }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          setError(data.error ?? 'Error al iniciar el pago')
          setLoadingPlan(null)
        }
      } catch {
        setError('Error de conexión')
        setLoadingPlan(null)
      }
    })
  }

  const planKeys = ['inicio', 'crecimiento', 'estrategico']

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planKeys.map(planKey => {
          const plan = plans[planKey]
          if (!plan) return null

          const isCurrent   = planKey === currentPlan
          const isHigher    = PLAN_ORDER[planKey] > PLAN_ORDER[currentPlan]
          const isPopular   = planKey === 'crecimiento'
          const isLoading   = loadingPlan === planKey

          return (
            <div
              key={planKey}
              className={`relative bg-slate-900 border rounded-2xl p-6 flex flex-col ${
                isCurrent
                  ? 'border-emerald-500/60'
                  : isPopular && !isCurrent
                    ? 'border-blue-500/40'
                    : 'border-slate-800'
              }`}
            >
              {isPopular && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-blue-500 text-white px-3 py-0.5 rounded-full font-medium">
                  Más popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-emerald-500 text-white px-3 py-0.5 rounded-full font-medium">
                  Tu plan actual
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-white font-semibold text-sm mb-1">{plan.label}</h3>
                <p className={`text-2xl font-bold tabular-nums ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                  {plan.priceLabel}
                </p>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-400 text-xs">
                    <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button disabled className="w-full py-2.5 rounded-lg text-sm bg-slate-800 text-slate-500 cursor-not-allowed">
                  Plan actual
                </button>
              ) : planKey === 'inicio' && isLoggedIn ? (
                <button disabled className="w-full py-2.5 rounded-lg text-sm bg-slate-800 text-slate-500 cursor-not-allowed">
                  Gestionar desde el portal
                </button>
              ) : (
                <button
                  onClick={() => handleSelectPlan(planKey)}
                  disabled={!!loadingPlan}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                    isHigher || !isLoggedIn
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isLoading
                    ? 'Redirigiendo...'
                    : !isLoggedIn
                      ? 'Empezar ahora'
                      : isHigher
                        ? 'Actualizar plan'
                        : 'Cambiar a este plan'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
