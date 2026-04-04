/**
 * lib/stripe.ts
 * ──────────────────────────────────────────────────────────────
 * Singleton del cliente Stripe para uso en server-side code.
 *
 * Variables de entorno requeridas (añadir a .env.local y a Vercel):
 *   STRIPE_SECRET_KEY        — sk_live_... o sk_test_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_...
 *   STRIPE_PRICE_CRECIMIENTO — price_... (id del precio mensual del plan Crecimiento)
 *   STRIPE_PRICE_ESTRATEGICO — price_... (id del precio mensual del plan Estratégico)
 *   NEXT_PUBLIC_APP_URL      — https://vysite-margen.vercel.app
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY no configurado — las operaciones Stripe fallarán')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2025-08-27.basil',
})

// Plan → Stripe Price ID mapping
export const STRIPE_PRICES: Record<string, string | undefined> = {
  crecimiento: process.env.STRIPE_PRICE_CRECIMIENTO,
  estrategico: process.env.STRIPE_PRICE_ESTRATEGICO,
}

// Plan tier labels y precios (para mostrar en UI)
export const PLAN_PRICING = {
  inicio: {
    label: 'Plan Inicio',
    price: 0,
    priceLabel: 'Gratis',
    features: [
      'Subida de CSV manual',
      'Dashboard resumen',
      'Análisis de margen básico',
      '1 ciclo mensual',
    ],
  },
  crecimiento: {
    label: 'Plan Crecimiento',
    price: 149,
    priceLabel: '149 €/mes',
    features: [
      'Todo lo de Inicio',
      'Módulo de oportunidades',
      'Análisis detallado de margen',
      'Gráficas interactivas',
      'Exportación de informes',
    ],
  },
  estrategico: {
    label: 'Plan Estratégico',
    price: 299,
    priceLabel: '299 €/mes',
    features: [
      'Todo lo de Crecimiento',
      'Análisis de comerciales',
      'Módulo de riesgo de clientes',
      'Objetivos y alertas',
      'Soporte prioritario',
    ],
  },
}
