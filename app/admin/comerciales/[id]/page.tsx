import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ManageComercialClients from '@/components/admin/ManageComercialClients'

export default async function ComercialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: comercialId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  // Datos del comercial
  const { data: userData } = await supabase.auth.admin.getUserById(comercialId)
  if (!userData?.user) notFound()

  // Comprobar que tiene rol comercial
  const { data: role } = await supabase
    .from('user_roles').select('role').eq('user_id', comercialId).single()
  if (role?.role !== 'comercial') notFound()

  // Clientes asignados
  const { data: assignments } = await supabase
    .from('comercial_clients')
    .select('client_id')
    .eq('comercial_user_id', comercialId)

  const assignedIds = (assignments ?? []).map(a => a.client_id)

  // Todos los clientes activos
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, company_name, contact_name, plan')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('company_name')

  const comercial = {
    user_id:      userData.user.id,
    email:        userData.user.email ?? '',
    display_name: (userData.user.user_metadata?.display_name as string) ?? userData.user.email ?? '',
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/comerciales" className="text-slate-400 hover:text-white text-sm transition-colors">← Comerciales</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-medium">{comercial.display_name}</span>
          </div>
          <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">
            {comercial.email}
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <ManageComercialClients
          comercial={comercial}
          allClients={allClients ?? []}
          assignedIds={assignedIds}
        />
      </div>
    </div>
  )
}
