import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitoring'

// Stripe requiere el body raw (sin parsear) para verificar la firma
export const config = { api: { bodyParser: false } }

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

/**
 * POST /api/stripe/webhook
 * Procesa eventos de Stripe: checkout completado, suscripción actualizada/cancelada.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Sin firma' }, { status: 400 })
  }

  let event
  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe/webhook] Firma inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (event.type) {

      // ── Checkout completado: asociar customer y activar plan ──────────────
      case 'checkout.session.completed': {
        const session = event.data.object as {
          customer: string
          subscription: string
          metadata: Record<string, string> | null
        }

        const clientId   = session.metadata?.client_id
        const plan       = session.metadata?.plan
        const customerId = session.customer
        const subId      = session.subscription

        if (!clientId || !plan) break

        await supabase
          .from('clients')
          .update({
            plan,
            stripe_customer_id:     customerId,
            stripe_subscription_id: subId,
            stripe_subscription_status: 'active',
          })
          .eq('id', clientId)

        await supabase.from('system_logs').insert({
          action: 'plan_activado',
          client_id: clientId,
          details: { plan, stripe_customer_id: customerId, stripe_subscription_id: subId },
        })
        break
      }

      // ── Suscripción actualizada (upgrade/downgrade, renovación) ──────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as {
          id: string
          status: string
          current_period_end: number
          metadata: Record<string, string>
        }

        const clientId = sub.metadata?.client_id
        if (!clientId) {
          // Fallback: buscar por subscription_id
          await supabase
            .from('clients')
            .update({
              stripe_subscription_status: sub.status,
              stripe_current_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', sub.id)
        } else {
          await supabase
            .from('clients')
            .update({
              stripe_subscription_status: sub.status,
              stripe_current_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
            })
            .eq('id', clientId)
        }
        break
      }

      // ── Suscripción cancelada: volver a plan inicio ───────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as {
          id: string
          metadata: Record<string, string>
        }

        const clientId = sub.metadata?.client_id
        if (clientId) {
          await supabase
            .from('clients')
            .update({
              plan: 'inicio',
              stripe_subscription_id:     null,
              stripe_subscription_status: 'canceled',
            })
            .eq('id', clientId)
        } else {
          await supabase
            .from('clients')
            .update({
              plan: 'inicio',
              stripe_subscription_id:     null,
              stripe_subscription_status: 'canceled',
            })
            .eq('stripe_subscription_id', sub.id)
        }

        await supabase.from('system_logs').insert({
          action: 'plan_cancelado',
          client_id: clientId ?? null,
          details:   { stripe_subscription_id: sub.id },
        })
        break
      }

      // ── Pago fallido: notificar (no bajar plan inmediatamente) ────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as {
          customer: string
          subscription: string
        }

        await supabase
          .from('clients')
          .update({ stripe_subscription_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer)

        await supabase.from('system_logs').insert({
          action: 'pago_fallido',
          details: {
            stripe_customer_id:     invoice.customer,
            stripe_subscription_id: invoice.subscription,
          },
        })
        break
      }
    }
  } catch (err) {
    await captureError(err, { module: `stripe/webhook/${event.type}` })
    return NextResponse.json({ error: 'Error procesando evento' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
