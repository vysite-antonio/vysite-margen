'use client'
import { useState } from 'react'
import type React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ company_name:'', contact_name:'', contact_email:'', password:'', erp:'PCCOM' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/clients', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setError(data.error||'Error al crear cliente'); setSaving(false); return }
    router.push(`/admin/clients/${data.client.id}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-slate-400 hover:text-white text-sm transition-colors">← Admin</Link>
          <span className="text-slate-700">/</span>
          <span className="text-white text-sm font-medium">Nuevo cliente</span>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-white font-semibold text-lg mb-6">Crear nuevo cliente</h1>
          <form onSubmit={handleSubmit} className="space-y-5">
            {([
              ['Empresa','company_name','text','Distribuciones García SL'],
              ['Nombre de contacto','contact_name','text','Juan García'],
              ['Email de acceso','contact_email','email','juan@garcia.es'],
              ['Contraseña inicial','password','password','Mínimo 8 caracteres'],
            ] as const).map(([label, key, type, ph]) => (
              <div key={key}>
                <label className="block text-slate-400 text-sm mb-1.5">{label}</label>
                <input type={type} value={form[key]} onChange={e => setForm(p=>({...p,[key]:e.target.value}))}
                  placeholder={ph} required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"/>
              </div>
            ))}
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">ERP del cliente</label>
              <select value={form.erp} onChange={e => setForm(p=>({...p,erp:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500">
                {['PCCOM','Sage','SAP','Otro'].map(e=><option key={e}>{e}</option>)}
              </select>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3"><p className="text-red-400 text-sm">{error}</p></div>}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
              <p className="text-amber-400 text-xs">El cliente podrá acceder con este email y contraseña.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Link href="/admin" className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm transition-colors">Cancelar</Link>
              <button type="submit" disabled={saving}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white disabled:text-slate-500 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Creando...' : 'Crear cliente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

