import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'
import { captureError } from '@/lib/monitoring'

/**
 * POST /api/stripe/checkout
 * Crea una sesión de Stripe Checkout para cambiar de plan.
 * Body: { plan: 'crecimiento' | 'estrategico' }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { plan } = await req.json()
    if (!plan || !['crecimiento', 'estrategico'].includes(plan)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    const priceId = STRIPE_PRICES[plan]
    if (!priceId) {
      return NextResponse.json(
        { error: `STRIPE_PRICE_${plan.toUpperCase()} no configurado` },
        { status: 500 }
      )
    }

    // Obtener cliente y su stripe_customer_id si ya existe
    const { data: client } = await supabase
      .from('clients')
      .select('id, stripe_customer_id, contact_email, company_name')
      .eq('user_id', user.id)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer:       client.stripe_customer_id ?? undefined,
      customer_email: client.stripe_customer_id ? undefined : (user.email ?? client.contact_email),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/pricing?cancel=1`,
      allow_promotion_codes: true,
      metadata: {
        client_id: client.id,
        plan,
      },
      subscription_data: {
        metadata: { client_id: client.id, plan },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    await captureError(err, { module: 'stripe/checkout' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
