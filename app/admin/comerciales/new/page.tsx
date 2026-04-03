import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CreateComercialForm from '@/components/admin/CreateComercialForm'

export default async function NewComercialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/admin/comerciales" className="text-slate-400 hover:text-white text-sm transition-colors">← Comerciales</Link>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-medium">Nuevo comercial</span>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <CreateComercialForm />
      </div>
    </div>
  )
}
