import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')
  const bucket = searchParams.get('bucket')

  if (!filePath || !bucket) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  if (!['csv-uploads', 'reports'].includes(bucket)) return NextResponse.json({ error: 'Bucket no permitido' }, { status: 403 })

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

