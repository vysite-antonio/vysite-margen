'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestNewCycle } from '@/lib/actions/cycles'

export default function RequestCycleButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()

  const handleRequest = () => {
    if (!confirmed) { setConfirmed(true); return }
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result = await requestNewCycle()
      if (result.error) {
        setError(result.error)
        setConfirmed(false)
      } else {
        setSuccess(`Ciclo creado para el período ${result.periodLabel}`)
        router.refresh()
      }
    })
  }

  return (
    <div className="border border-dashed border-emerald-800/60 bg-emerald-950/20 rounded-2xl p-6 text-center">
      <div className="text-4xl mb-3">🔄</div>
      <h3 className="text-white font-semibold text-sm mb-1">¿Listo para el siguiente análisis?</h3>
      <p className="text-slate-400 text-xs mb-5 max-w-xs mx-auto">
        El ciclo anterior está completado. Solicita un nuevo análisis para el período actual y sube tu CSV.
      </p>

      {!success && (
        <>
          {confirmed ? (
            <div className="space-y-3">
              <p className="text-amber-400 text-xs">
                Se creará un nuevo ciclo para el período actual. ¿Confirmas?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setConfirmed(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-lg border border-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRequest}
                  disabled={isPending}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition-colors"
                >
                  {isPending ? 'Creando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleRequest}
              className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-6 py-2.5 rounded-lg transition-colors font-medium"
            >
              Solicitar nuevo análisis
            </button>
          )}
        </>
      )}

      {success && (
        <p className="text-emerald-400 text-sm font-medium">✓ {success}</p>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
    </div>
  )
}
