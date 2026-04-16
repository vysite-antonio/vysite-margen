import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/log-error
 * Recibe errores de cliente y los persiste en system_logs.
 * No requiere autenticación para no bloquear el reporte de errores de auth.
 * Protegido con rate limiting: 20 req / 60s por IP.
 */
export async function POST(req: NextRequest) {
  // ── Rate limiting: 20 errores por IP por minuto ───────────────────────────
  const ip  = getClientIp(req)
  const rl  = rateLimit(ip, 'log-error', { limit: 20, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ ok: false }, {
      status: 429,
      headers: {
        'Retry-After':       String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Reset': String(rl.resetAt),
      },
    })
  }

  try {
    const body = await req.json()
    const { module, message, stack, extra, client_id } = body

    if (!message) return NextResponse.json({ ok: false }, { status: 400 })

    // Validar client_id solo acepta UUIDs para evitar polución de datos
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const safeClientId = client_id && uuidRe.test(String(client_id)) ? client_id : null

    const supabase = await createClient()
    await supabase.from('system_logs').insert({
      action: 'error_cliente',
      client_id: safeClientId,
      details: {
        module:  String(module ?? 'client').slice(0, 50),
        message: String(message).slice(0, 500),
        stack:   stack ? String(stack).slice(0, 1000) : undefined,
        ip,
        // No incluir `extra` directamente para evitar inyección de campos
        ...(extra && typeof extra === 'object' ? { extra } : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    // Silencioso para no crear bucles de error
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
