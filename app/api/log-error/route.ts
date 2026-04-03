import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/log-error
 * Recibe errores de cliente y los persiste en system_logs.
 * No requiere autenticación para no bloquear el reporte de errores de auth.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { module, message, stack, extra, client_id } = body

    if (!message) return NextResponse.json({ ok: false }, { status: 400 })

    const supabase = await createClient()
    await supabase.from('system_logs').insert({
      action: 'error_cliente',
      client_id: client_id ?? null,
      details: {
        module:  module ?? 'client',
        message: String(message).slice(0, 500),   // limitar tamaño
        stack:   stack ? String(stack).slice(0, 1000) : undefined,
        ...extra,
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    // Silencioso para no crear bucles de error
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
