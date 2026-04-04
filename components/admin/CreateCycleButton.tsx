'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CreateCycleButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const today = new Date()
  const day = today.getDate()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const defaultStart = day <= 15 ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 16)
  const defaultEnd = day <= 15 ? new Date(today.getFullYear(), today.getMonth(), 15) : new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const [start, setStart] = useState(fmt(defaultStart))
  const [end, setEnd] = useState(fmt(defaultEnd))

  const handleCreate = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('create_analysis_cycle', { p_client_id: clientId, p_period_start: start, p_period_end: end })
    setSaving(false)
    if (!error) { setOpen(false); router.refresh() }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded-lg transition-colors">
        + Nuevo ciclo
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-5">Crear ciclo de análisis</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Inicio del período</label>
                <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"/>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Fin del período</label>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"/>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm transition-colors">Cancelar</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white py-2.5 rounded-lg text-sm transition-colors">
                {saving ? 'Creando...' : 'Crear ciclo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

