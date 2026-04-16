/**
 * lib/rate-limit.ts
 * ─────────────────────────────────────────────────────────────
 * Rate limiter en memoria para Route Handlers de Next.js.
 * Suficiente para Vercel (cada instancia tiene su propio estado)
 * combinado con la protección DDoS de Vercel/Supabase.
 *
 * Para escalar a multi-instancia → reemplazar por Upstash Redis.
 */

interface Entry {
  count:     number
  resetAt:   number
}

// Map global: persiste entre requests en la misma instancia Edge/Node
const store = new Map<string, Entry>()

// Limpieza periódica para no acumular entradas caducadas (cada 5 min)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((v, k) => { if (v.resetAt < now) store.delete(k) })
  }, 5 * 60 * 1000)
}

export interface RateLimitOptions {
  /** Número máximo de requests en la ventana */
  limit:    number
  /** Duración de la ventana en segundos */
  windowSec: number
}

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   number  // epoch ms
}

/**
 * Verifica si la IP ha superado el límite.
 * @param ip  — IP del cliente (usar request.ip o x-forwarded-for)
 * @param key — Clave para segmentar (ej: 'log-error', 'contact')
 */
export function rateLimit(
  ip: string,
  key: string,
  { limit, windowSec }: RateLimitOptions
): RateLimitResult {
  const storeKey = `${key}:${ip}`
  const now      = Date.now()
  const entry    = store.get(storeKey)

  if (!entry || entry.resetAt < now) {
    // Nueva ventana
    const resetAt = now + windowSec * 1000
    store.set(storeKey, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/**
 * Extrae la IP del cliente desde los headers de Next.js.
 */
export function getClientIp(request: Request): string {
  // Vercel pone la IP real en x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
