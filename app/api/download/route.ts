import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')
  const bucket = searchParams.get('bucket')

  if (!filePath || !bucket) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  if (!['csv-uploads', 'reports'].includes(bucket)) return NextResponse.json({ error: 'Bucket no permitido' }, { status: 403 })

  // Verificar que el archivo pertenece al cliente del usuario autenticado
  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()

  const isAdmin = roleData?.role === 'admin'

  if (!isAdmin) {
    // Para clientes: el file_path tiene formato clientId/cycleId/... — verificar que el clientId coincide
    const { data: clientData } = await supabase
      .from('clients').select('id').eq('user_id', user.id).single()

    if (!clientData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 403 })

    const pathClientId = filePath.split('/')[0]
    if (pathClientId !== clientData.id) {
      return NextResponse.json({ error: 'No tienes acceso a este archivo' }, { status: 403 })
    }
  }

  const { data, error } = await supabase.storage.from(bucket).download(filePath)
  if (error || !data) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  const fileName = filePath.split('/').pop() || 'archivo'
  const contentType = fileName.endsWith('.xlsx')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : fileName.endsWith('.csv') ? 'text/csv'
    : fileName.endsWith('.pdf') ? 'application/pdf'
    : 'application/octet-stream'

  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}

