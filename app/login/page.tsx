'use client'

import { useState } from 'react'
import type React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: roleData } = await supabase
        .from('user_roles').select('role').eq('user_id', data.user.id).single()
      const destination = roleData?.role === 'admin' ? '/admin' : '/dashboard'
      router.push(destination)
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">VM</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">Vysite Margen</span>
          </div>
          <p className="text-slate-400 text-sm">Portal de recuperación de margen</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-white font-semibold text-lg mb-6">Acceder</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="tu@email.com" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••" />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white disabled:text-slate-500 rounded-lg py-2.5 text-sm font-medium transition-colors mt-2">
              {loading ? 'Accediendo...' : 'Acceder'}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">Vysite.es</p>
      </div>
    </div>
  )
}

