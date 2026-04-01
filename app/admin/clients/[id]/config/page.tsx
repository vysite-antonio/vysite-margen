import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import UpdateClientConfig from '@/components/admin/UpdateClientConfig'

export default async function AdminClientConfig({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('*, erp_profiles(id, name, slug)')
    .eq('id', id)
    .single()
  if (!client) notFound()

  // Todos los perfiles ERP disponibles para el selector
  const { data: erpProfiles } = await supabase
    .from('erp_profiles')
    .select('id, name, slug, file_types')
    .order('name')

  // Comerciales detectados en el último análisis
  const { data: kpisData } = await supabase
    .from('kpis')
    .select('extended_data')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const erpComerciales: string[] = []
  if (kpisData?.extended_data) {
    const ext = kpisData.extended_data as { comerciales?: Array<{ nombre_erp: string }> }
    ext.comerciales?.forEach(c => {
      if (c.nombre_erp && !erpComerciales.includes(c.nombre_erp)) {
        erpComerciales.push(c.nombre_erp)
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href={`/admin/clients/${id}`} className="text-slate-400 hover:text-white text-sm transition-colors">
            ← {client.company_name}
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-medium">Configuración</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Info del cliente */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h1 className="text-white font-semibold mb-1">{client.company_name}</h1>
          <p className="text-slate-400 text-sm">{client.contact_email}</p>
          <div className="flex gap-2 mt-3">
            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">
              ERP: {(client as any).erp_profiles?.name ?? client.config?.erp ?? 'Sin asignar'}
            </span>
            <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">
              Plan: {client.plan ?? 'inicio'}
            </span>
          </div>
        </div>

        {/* Formulario de configuración */}
        <UpdateClientConfig
          clientId={id}
          config={client.config ?? {}}
          plan={client.plan ?? 'inicio'}
          erpComerciales={erpComerciales}
          erpProfiles={erpProfiles ?? []}
          currentErpProfileId={client.erp_profile_id ?? null}
        />
      </div>
    </div>
  )
}
