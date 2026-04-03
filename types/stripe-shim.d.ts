/**
 * Minimal type shim para Stripe — se reemplaza automáticamente cuando
 * Antonio ejecute `npm install` en su máquina (instala el paquete real).
 * Sólo necesario para que tsc compile en el sandbox donde npm install falla.
 */
declare module 'stripe' {
  interface StripeConstructorOptions {
    apiVersion?: string
  }

  interface CheckoutSessionCreateParams {
    payment_method_types?: string[]
    mode: 'subscription' | 'payment' | 'setup'
    customer?: string
    customer_email?: string
    line_items: Array<{ price: string; quantity?: number }>
    success_url: string
    cancel_url: string
    metadata?: Record<string, string>
    subscription_data?: Record<string, unknown>
    allow_promotion_codes?: boolean
  }

  interface BillingPortalSessionCreateParams {
    customer: string
    return_url: string
  }

  interface CustomerCreateParams {
    email?: string
    name?: string
    metadata?: Record<string, string>
  }

  interface Subscription {
    id: string
    status: string
    current_period_end: number
    items: { data: Array<{ price: { id: string } }> }
  }

  interface CheckoutSession {
    id: string
    url: string | null
    customer: string | null
    subscription: string | null
    metadata: Record<string, string> | null
  }

  interface BillingPortalSession {
    url: string
  }

  interface Customer {
    id: string
    email: string | null
  }

  interface Event {
    type: string
    data: { object: Record<string, unknown> }
  }

  class Stripe {
    constructor(secretKey: string, options?: StripeConstructorOptions)
    checkout: {
      sessions: {
        create(params: CheckoutSessionCreateParams): Promise<CheckoutSession>
      }
    }
    billingPortal: {
      sessions: {
        create(params: BillingPortalSessionCreateParams): Promise<BillingPortalSession>
      }
    }
    customers: {
      create(params: CustomerCreateParams): Promise<Customer>
    }
    subscriptions: {
      retrieve(id: string): Promise<Subscription>
    }
    webhooks: {
      constructEvent(payload: string | Buffer, header: string, secret: string): Event
    }
  }

  export = Stripe
}
