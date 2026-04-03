'use client'

import { useState, useTransition } from 'react'

export default function BillingPortalButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handlePortal = () => {
    setIsLoading(true)
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/stripe/portal', { method: 'POST' })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          setError(data.error ?? 'Error al abrir el portal')
          setIsLoading(false)
        }
      } catch {
        setError('Error de conexión')
        setIsLoading(false)
      }
    })
  }

  return (
    <div>
      <button
        onClick={handlePortal}
        disabled={isLoading}
        className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
      >
        {isLoading ? 'Abriendo portal...' : 'Gestionar suscripción →'}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
