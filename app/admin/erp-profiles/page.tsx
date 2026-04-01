import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const CAPABILITY_LABELS: Record<string, string> = {
  facturacion_cliente:    'Facturación/cliente',
  facturacion_comercial:  'Facturación/comercial',
  riesgo_cobro:           'Riesgo de cobro',
  tendencia_temporal:     'Tendencia temporal',
  margen_categoria:       'Margen por categoría',
  oportunidades_mix:      'Oportunidades mix',
  oportunidades_categoria:'Oportunidades categoría',
  riesgo_cliente:         'Riesgo de cliente',
  segmentacion_cliente:   'Segmentación',
}

export default async function ErpProfilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleData?.role !== 'admin') redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('erp_profiles')
    .select('id, name, slug, description, file_types, created_at')
    .order('name')

  // Contar cuántos clientes usan cada perfil
  const { data: clients } = await supabase
    .from('clients')
    .select('erp_profile_id')
    .not('erp_profile_id', 'is', null)

  const clientCount = (profileId: string) =>
    clients?.filter(c => c.erp_profile_id === profileId).length ?? 0

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-400 hover:text-white text-sm transition-colors">
              ← Admin
            </Link>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔌</span>
              <span className="text-white text-sm font-medium">Perfiles ERP</span>
            </div>
          </div>
          <Link
            href="/admin/erp-profiles/new"
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo perfil
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        <div className="mb-6">
          <h1 className="text-white font-semibold text-lg mb-1">Perfiles de ERP</h1>
          <p className="text-slate-400 text-sm">
            Define los parámetros de cada sistema ERP: tipos de fichero, columnas esperadas e instrucciones de exportación.
            Asigna un perfil a cada cliente para que el sistema sepa cómo interpretar sus CSVs.
          </p>
        </div>

        {!profiles?.length ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400 text-2xl mb-3">🔌</p>
            <p className="text-white font-medium mb-1">Sin perfiles configurados</p>
            <p className="text-slate-400 text-sm mb-4">Crea el primer perfil ERP para empezar.</p>
            <Link href="/admin/erp-profiles/new"
              className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-5 py-2.5 rounded-xl transition-colors">
              Crear perfil
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.map((profile: any) => {
              const fileTypes: any[] = profile.file_types ?? []
              const allCaps = [...new Set(fileTypes.flatMap((ft: any) => ft.analysis_capabilities ?? []))]
              const count = clientCount(profile.id)
              return (
                <Link
                  key={profile.id}
                  href={`/admin/erp-profiles/${profile.slug}`}
                  className="block bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-6 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">{profile.name}</span>
                        <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded">
                          {profile.slug}
                        </span>
                      </div>
                      {profile.description && (
                        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                          {profile.description}
                        </p>
                      )}
                    </div>
                    <span className="text-slate-600 group-hover:text-emerald-400 transition-colors text-sm ml-3">→</span>
                  </div>

                  {/* Tipos de fichero */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {fileTypes.map((ft: any) => (
                      <span key={ft.key}
                        className="text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-full">
                        📄 {ft.label}
                      </span>
                    ))}
                  </div>

                  {/* Capacidades de análisis */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {allCaps.slice(0, 4).map((cap: string) => (
                      <span key={cap}
                        className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {CAPABILITY_LABELS[cap] ?? cap}
                      </span>
                    ))}
                    {allCaps.length > 4 && (
                      <span className="text-xs text-slate-500 px-2 py-0.5">+{allCaps.length - 4} más</span>
                    )}
                  </div>

                  <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
                    <span className="text-slate-500 text-xs">
                      {count === 0 ? 'Sin clientes asignados' : `${count} cliente${count !== 1 ? 's' : ''} asignado${count !== 1 ? 's' : ''}`}
                    </span>
                    <span className="text-emerald-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Editar →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
