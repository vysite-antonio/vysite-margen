'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createComercialAccount } from '@/lib/actions/comerciales'

export default function CreateComercialForm() {
  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.displayName) {
      setError('Todos los campos son obligatorios')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createComercialAccount(form.email, form.password, form.displayName)
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/admin/comerciales/${result.userId}`)
      }
    })
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
      <h2 className="text-white font-semibold mb-1">Crear cuenta de comercial</h2>
      <p className="text-slate-500 text-xs mb-6">El comercial podrá acceder al panel y ver los clientes que le asignes.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Nombre para mostrar</label>
          <input
            type="text"
            value={form.displayName}
            onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
            placeholder="ej. Carlos Martínez"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="comercial@empresa.com"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Contraseña temporal</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            placeholder="Mínimo 8 caracteres"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <p className="text-slate-600 text-xs mt-1">El comercial podrá cambiarla desde su perfil.</p>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm transition-colors font-medium"
          >
            {isPending ? 'Creando...' : 'Crear comercial'}
          </button>
        </div>
      </form>
    </div>
  )
}
