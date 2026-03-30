import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body = await request.json()
  const { company_name, contact_name, contact_email, password, erp } = body

  if (!company_name || !contact_name || !contact_email || !password) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: contact_email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Error creando usuario' }, { status: 400 })
  }

  const newUserId = authData.user.id

  try {
    await serviceClient.from('user_roles').insert({ user_id: newUserId, role: 'client' })

    const { data: clientData, error: clientError } = await serviceClient
      .from('clients')
      .insert({
        user_id: newUserId,
        company_name,
        contact_name,
        contact_email,
        config: {
          margins: { Limpieza:0.35, Drogueria:0.32, Menaje:0.28, Alimentacion:0.22, Bebidas:0.18, Fresco:0.15, Otros:0.20 },
          category_mapping: {},
          erp: erp || 'PCCOM',
          delivery_day_1: 1,
          delivery_day_2: 15,
        }
      })
      .select().single()

    if (clientError) throw clientError

    await serviceClient.from('system_logs').insert({
      action: 'cliente_creado',
      user_id: user.id,
      client_id: clientData.id,
      details: { company_name, contact_email }
    })

    return NextResponse.json({ success: true, client: clientData, user_id: newUserId })

  } catch (err: unknown) {
    await serviceClient.auth.admin.deleteUser(newUserId)
    const msg = err instanceof Error ? err.message : 'Error creando cliente'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

