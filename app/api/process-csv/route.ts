import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()

  // Verificar que el usuario está autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Parsear body
  let body: { file_id: string; cycle_id: string; client_id: string; file_path: string; file_name: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { file_id, cycle_id, client_id, file_path, file_name } = body
  if (!cycle_id || !client_id || !file_path) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verificar que el ciclo pertenece al cliente del usuario autenticado
  const { data: clientData } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', client_id)
    .single()

  if (!clientData) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Llamar al Edge Function con service_role key (server-side, seguro)
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-csv`
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
  }

  // Fire-and-forget: no esperamos a que termine para responder al cliente
  // El dashboard se actualizará con el nuevo estado mediante router.refresh()
  fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ file_id, cycle_id, client_id, file_path, file_name }),
  }).catch(err => {
    console.error('[API /process-csv] Error llamando Edge Function:', err)
  })

  return NextResponse.json({ queued: true })
}
