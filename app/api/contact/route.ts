import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/contact
 * Guarda el lead en contact_leads y envía un email a comercial@vysite.es
 * mediante la API de Resend (o fallback a console si no está configurado).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, empresa, email, telefono, mensaje } = body

    if (!nombre || !email) {
      return NextResponse.json({ error: 'Nombre y email son obligatorios' }, { status: 400 })
    }

    const supabase = await createClient()

    // Persistir lead en base de datos
    await supabase.from('contact_leads').insert({
      nombre:   String(nombre).slice(0, 100),
      empresa:  empresa ? String(empresa).slice(0, 100) : null,
      email:    String(email).slice(0, 200),
      telefono: telefono ? String(telefono).slice(0, 30) : null,
      mensaje:  mensaje ? String(mensaje).slice(0, 1000) : null,
    })

    // Enviar email vía Resend si está configurado
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const emailBody = [
        `Nombre: ${nombre}`,
        empresa ? `Empresa: ${empresa}` : '',
        `Email: ${email}`,
        telefono ? `Teléfono: ${telefono}` : '',
        mensaje ? `\nMensaje:\n${mensaje}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'Vysite Margen <noreply@vysite.es>',
          to:      ['comercial@vysite.es'],
          subject: 'VYSITE MARGEN',
          text:    emailBody,
        }),
      })
    } else {
      // Fallback: log en servidor para desarrollo
      console.info('[contact] Nuevo lead (RESEND_API_KEY no configurado):', { nombre, empresa, email, telefono })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact] Error al procesar formulario:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
