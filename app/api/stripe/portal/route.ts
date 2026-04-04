import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { captureError } from '@/lib/monitoring.server'

/**
 * POST /api/stripe/portal
 * Redirige al cliente al portal de facturación de Stripe
 * para gestionar su suscripción, método de pago e historial.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: client } = await supabase
      .from('clients')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!client?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No hay suscripción activa para gestionar' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   client.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    await captureError(err, { module: 'stripe/portal' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
