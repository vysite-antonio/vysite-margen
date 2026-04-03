'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignClientToComercial, unassignClientFromComercial } from '@/lib/actions/comerciales'

interface Client {
  id: string
  company_name: string
  contact_name: string
  plan: string
}

interface Comercial {
  user_id: string
  email: string
  display_name: string
}

interface Props {
  comercial: Comercial
  allClients: Client[]
  assignedIds: string[]
}

export default function ManageComercialClients({ comercial, allClients, assignedIds }: Props) {
  const [assigned, setAssigned] = useState<Set<string>>(new Set(assignedIds))
  const [pending, setPending] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const toggle = (clientId: string) => {
    if (isPending) return
    setPending(clientId)
    const isAssigned = assigned.has(clientId)

    startTransition(async () => {
      const result = isAssigned
        ? await unassignClientFromComercial(comercial.user_id, clientId)
        : await assignClientToComercial(comercial.user_id, clientId)

      if (!result.error) {
        setAssigned(prev => {
          const next = new Set(prev)
          isAssigned ? next.delete(clientId) : next.add(clientId)
          return next
        })
      }
      setPending(null)
      router.refresh()
    })
  }

  const planColors: Record<string, string> = {
    inicio:      'text-slate-400 bg-slate-800 border-slate-700',
    crecimiento: 'text-blue-400 bg-blue-950/40 border-blue-800/50',
    estrategico: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
  }

  const assignedClients = allClients.filter(c => assigned.has(c.id))
  const unassignedClients = allClients.filter(c => !assigned.has(c.id))

  return (
    <div className="space-y-6">
      {/* Header de info del comercial */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-semibold text-sm">
            {comercial.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-medium">{comercial.display_name}</p>
            <p className="text-slate-500 text-xs">{comercial.email}</p>
          </div>
          <div className="ml-auto">
            <span className="text-slate-400 text-sm font-semibold">{assigned.size}</span>
            <span className="text-slate-600 text-xs ml-1">cliente{assigned.size !== 1 ? 's' : ''} asignado{assigned.size !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Clientes asignados */}
      <div>
        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Clientes asignados ({assignedClients.length})
        </h3>
        {assignedClients.length === 0 ? (
          <p className="text-slate-600 text-sm p-4 text-center">Sin clientes asignados aún</p>
        ) : (
          <div className="space-y-2">
            {assignedClients.map(client => (
              <div key={client.id}
                className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{client.company_name}</p>
                  <p className="text-slate-500 text-xs">{client.contact_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${planColors[client.plan] ?? planColors.inicio}`}>
                    {client.plan}
                  </span>
                  <button
                    onClick={() => toggle(client.id)}
                    disabled={pending === client.id}
                    className="text-red-400 hover:text-red-300 text-xs border border-red-800/40 hover:border-red-700/60 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {pending === client.id ? '...' : 'Quitar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clientes disponibles para asignar */}
      {unassignedClients.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Clientes disponibles
          </h3>
          <div className="space-y-2">
            {unassignedClients.map(client => (
              <div key={client.id}
                className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 opacity-70 hover:opacity-100 transition-opacity">
                <div>
                  <p className="text-slate-300 text-sm">{client.company_name}</p>
                  <p className="text-slate-600 text-xs">{client.contact_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${planColors[client.plan] ?? planColors.inicio}`}>
                    {client.plan}
                  </span>
                  <button
                    onClick={() => toggle(client.id)}
                    disabled={pending === client.id}
                    className="text-emerald-400 hover:text-emerald-300 text-xs border border-emerald-800/40 hover:border-emerald-700/60 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {pending === client.id ? '...' : '+ Asignar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
