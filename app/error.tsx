'use client'

import { useEffect } from 'react'
import { captureClientError } from '@/lib/monitoring'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureClientError(error, { module: 'global-error-boundary' })
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-400 text-xl">⚠️</span>
        </div>
        <h2 className="text-white font-semibold mb-2">Algo ha ido mal</h2>
        <p className="text-slate-400 text-sm mb-6">
          Ha ocurrido un error inesperado. El equipo ha sido notificado.
        </p>
        {error?.digest && (
          <p className="text-slate-600 text-xs font-mono mb-4">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-5 py-2 rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
