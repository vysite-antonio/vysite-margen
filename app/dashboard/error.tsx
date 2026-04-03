'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { captureClientError } from '@/lib/monitoring'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureClientError(error, { module: 'dashboard-error-boundary' })
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">📡</span>
        </div>
        <h2 className="text-white font-semibold mb-2">No se pudo cargar el panel</h2>
        <p className="text-slate-400 text-sm mb-6">
          Hubo un problema al conectar con el servidor. Puede ser un fallo temporal.
        </p>
        {error?.digest && (
          <p className="text-slate-600 text-xs font-mono mb-4">Ref: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-5 py-2 rounded-lg transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/login"
            className="text-slate-400 hover:text-slate-300 text-sm px-5 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
