import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ErpProfileEditor from '@/components/admin/ErpProfileEditor'

export default async function ErpProfileDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const isNew = slug === 'new'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  let profile: any = null

  if (!isNew) {
    const { data } = await supabase
      .from('erp_profiles')
      .select('*')
      .eq('slug', slug)
      .single()
    if (!data) notFound()
    profile = data
  }

  // Clientes que usan este perfil
  const { data: assignedClients } = isNew ? { data: [] } : await supabase
    .from('clients')
    .select('id, company_name, plan, contact_email')
    .eq('erp_profile_id', profile?.id ?? '')
    .eq('is_active', true)
    .is('deleted_at', null)

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/admin/erp-profiles" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← Perfiles ERP
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-medium">
            {isNew ? 'Nuevo perfil' : profile.name}
          </span>
          {!isNew && (
            <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded ml-1">
              {profile.slug}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        <ErpProfileEditor
          profileId={isNew ? null : profile.id}
          initialName={isNew ? '' : profile.name}
          initialSlug={isNew ? '' : profile.slug}
          initialDescription={isNew ? '' : (profile.description ?? '')}
          initialFileTypes={isNew ? [] : (profile.file_types ?? [])}
        />

        {/* Clientes asignados */}
        {!isNew && (assignedClients?.length ?? 0) > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-sm mb-4">
              Clientes con este perfil ({assignedClients!.length})
            </h2>
            <div className="space-y-2">
              {assignedClients!.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/admin/clients/${c.id}/config`}
                  className="flex items-center justify-between bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-4 py-3 transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{c.company_name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{c.contact_email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full capitalize">
                      {c.plan}
                    </span>
                    <span className="text-slate-500 text-sm">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
