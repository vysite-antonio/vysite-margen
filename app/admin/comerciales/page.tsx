import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminComercialesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  // Obtener roles comercial
  const { data: roles } = await supabase
    .from('user_roles').select('user_id').eq('role', 'comercial')

  // Para cada comercial: datos auth + nº clientes
  const comerciales = await Promise.all(
    (roles ?? []).map(async (r) => {
      const { data } = await supabase.auth.admin.getUserById(r.user_id)
      const { count } = await supabase
        .from('comercial_clients')
        .select('*', { count: 'exact', head: true })
        .eq('comercial_user_id', r.user_id)
      return {
        user_id:      r.user_id,
        email:        data?.user?.email ?? '—',
        display_name: (data?.user?.user_metadata?.display_name as string) ?? data?.user?.email ?? '—',
        client_count: count ?? 0,
      }
    })
  )

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-400 hover:text-white text-sm transition-colors">← Admin</Link>
            <span className="text-slate-700">/</span>
            <span className="text-white text-sm font-medium">Comerciales</span>
          </div>
          <Link href="/admin/comerciales/new"
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs px-4 py-2 rounded-lg transition-colors">
            + Nuevo comercial
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {comerciales.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
              <p className="text-slate-400 text-sm mb-3">No hay comerciales creados todavía.</p>
              <Link href="/admin/comerciales/new"
                className="text-emerald-400 text-sm hover:underline">
                Crear primer comercial →
              </Link>
            </div>
          )}
          {comerciales.map(c => (
            <Link key={c.user_id} href={`/admin/comerciales/${c.user_id}`}
              className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-5 py-4 transition-colors">
              <div>
                <p className="text-white font-medium text-sm">{c.display_name}</p>
                <p className="text-slate-500 text-xs">{c.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400 text-xs">
                  {c.client_count} cliente{c.client_count !== 1 ? 's' : ''} asignado{c.client_count !== 1 ? 's' : ''}
                </span>
                <span className="text-slate-600 text-xs">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
