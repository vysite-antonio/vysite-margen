import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PLAN_PRICING } from '@/lib/stripe'
import { PLAN_TIER_LABELS } from '@/types'
import type { PlanTier } from '@/types'
import PricingCards from '@/components/PricingCards'
import BillingPortalButton from '@/components/BillingPortalButton'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'client') redirect('/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('company_name, plan, stripe_customer_id, stripe_subscription_status, stripe_current_period_end')
    .eq('user_id', user.id)
    .single()

  if (!client) redirect('/login')

  const currentPlan = (client.plan as PlanTier) ?? 'inicio'
  const hasSubscription = !!client.stripe_customer_id

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-slate-400 hover:text-white text-sm transition-colors">← Dashboard</a>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-medium">Facturación y plan</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {success === '1' && (
          <div className="bg-emerald-950/50 border border-emerald-800/50 rounded-xl px-5 py-4 flex items-center gap-3">
            <span className="text-emerald-400 text-lg">✓</span>
            <div>
              <p className="text-emerald-300 font-medium text-sm">¡Plan activado correctamente!</p>
              <p className="text-emerald-600 text-xs mt-0.5">Tu nueva suscripción ya está activa. Disfruta de las nuevas funciones.</p>
            </div>
          </div>
        )}

        {/* Plan actual */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Plan actual</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-400 font-semibold text-lg">{PLAN_TIER_LABELS[currentPlan]}</p>
              {hasSubscription && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-slate-400 text-xs">
                    Estado:{' '}
                    <span className={
                      client.stripe_subscription_status === 'active' ? 'text-emerald-400' :
                      client.stripe_subscription_status === 'past_due' ? 'text-amber-400' : 'text-slate-400'
                    }>
                      {client.stripe_subscription_status === 'active'   ? 'Activo' :
                       client.stripe_subscription_status === 'past_due' ? 'Pago pendiente' :
                       client.stripe_subscription_status === 'canceled' ? 'Cancelado' :
                       client.stripe_subscription_status ?? '—'}
                    </span>
                  </p>
                  {client.stripe_current_period_end && (
                    <p className="text-slate-500 text-xs">
                      Próxima renovación: {new Date(client.stripe_current_period_end).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}
              {!hasSubscription && currentPlan === 'inicio' && (
                <p className="text-slate-500 text-xs mt-1">Plan gratuito sin suscripción activa.</p>
              )}
            </div>
            {hasSubscription && (
              <BillingPortalButton />
            )}
          </div>
        </div>

        {/* Cambio de plan */}
        <div>
          <h2 className="text-white font-semibold mb-4">Cambiar plan</h2>
          <PricingCards plans={PLAN_PRICING} isLoggedIn={true} currentPlan={currentPlan} />
        </div>
      </div>
    </div>
  )
}
