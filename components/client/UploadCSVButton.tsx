'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Props {
  clientId: string
  cycleId: string
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const STATE_LABELS: Record<UploadState, string> = {
  idle:       'Seleccionar archivo CSV',
  uploading:  'Subiendo archivo…',
  processing: 'Analizando datos…',
  done:       'Análisis completado',
  error:      'Error al subir',
}

// Estados del ciclo que indican que el procesado ha terminado
const TERMINAL_STATUSES = new Set(['completado', 'error_procesado', 'error'])

export default function UploadCSVButton({ clientId, cycleId }: Props) {
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // Limpia la suscripción Realtime al desmontar o al completar
  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [supabase])

  useEffect(() => {
    return () => unsubscribe()
  }, [unsubscribe])

  // Suscribe a cambios en el ciclo via Realtime para detectar fin de procesado
  const subscribeToRealtimeUpdates = useCallback(() => {
    // Evitar suscripciones duplicadas
    if (channelRef.current) unsubscribe()

    const channel = supabase
      .channel(`cycle-${cycleId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'analysis_cycles',
          filter: `id=eq.${cycleId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status as string | undefined
          if (!newStatus) return

          if (TERMINAL_STATUSES.has(newStatus)) {
            // El ciclo ha terminado (completado o con error)
            setState(newStatus === 'completado' ? 'done' : 'error')
            if (newStatus !== 'completado') {
              setError('El análisis terminó con un error. El equipo ha sido notificado.')
            }
            router.refresh()
            unsubscribe()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // Realtime no disponible: fallback silencioso — el usuario puede refrescar manualmente
          console.warn('[UploadCSVButton] Realtime no disponible, el ciclo se refrescará al recargar')
        }
      })

    channelRef.current = channel

    // Timeout de seguridad: si en 3 minutos no llega actualización, desconectar
    setTimeout(() => {
      if (channelRef.current) {
        unsubscribe()
        // Si todavía está en 'processing', hacer un refresh manual
        setState(prev => prev === 'processing' ? 'done' : prev)
        router.refresh()
      }
    }, 3 * 60 * 1000)
  }, [cycleId, supabase, router, unsubscribe])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      setError('Solo se aceptan archivos CSV o Excel')
      return
    }

    setState('uploading')
    setError(null)

    const filePath = `${clientId}/${cycleId}/${Date.now()}_${file.name}`

    // ── 1. Subir a Storage ──────────────────────────────────────────────
    const { error: uploadError } = await supabase.storage
      .from('csv-uploads')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setState('error')
      return
    }

    // ── 2. Registrar en uploaded_files ──────────────────────────────────
    const { data: fileRecord } = await supabase
      .from('uploaded_files')
      .insert({
        cycle_id: cycleId,
        client_id: clientId,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        file_type: file.type || 'text/csv',
        is_active: true,
      })
      .select('id')
      .single()

    // ── 3. Actualizar estado del ciclo ──────────────────────────────────
    await supabase
      .from('analysis_cycles')
      .update({ status: 'csv_recibido' })
      .eq('id', cycleId)

    await supabase.from('system_logs').insert({
      action: 'csv_subido',
      client_id: clientId,
      details: { file_name: file.name, cycle_id: cycleId },
    })

    // ── 4. Suscribir a Realtime ANTES de disparar el procesado ──────────
    setState('processing')
    subscribeToRealtimeUpdates()

    // ── 5. Disparar procesado automático (fire-and-forget) ──────────────
    try {
      await fetch('/api/process-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id:   fileRecord?.id ?? '',
          cycle_id:  cycleId,
          client_id: clientId,
          file_path: filePath,
          file_name: file.name,
        }),
      })
    } catch {
      // El procesado es best-effort; Realtime detectará el cambio de estado
      console.warn('[UploadCSVButton] No se pudo disparar procesado automático')
    }
  }

  const isDisabled = state !== 'idle' && state !== 'error'

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => {
          if (state === 'error') { setState('idle'); setError(null) }
          inputRef.current?.click()
        }}
        disabled={isDisabled}
        className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isDisabled
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}
      >
        {(state === 'uploading' || state === 'processing') && <Spinner />}
        {STATE_LABELS[state]}
      </button>

      {state === 'processing' && (
        <p className="text-slate-400 text-xs mt-2 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Esperando análisis… La página se actualizará en cuanto finalice.
        </p>
      )}

      {state === 'done' && (
        <p className="text-emerald-400 text-xs mt-2">
          ✓ Análisis completado · La página se ha actualizado
        </p>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-2">
          {error} ·{' '}
          <button className="underline" onClick={() => { setState('idle'); setError(null) }}>
            Reintentar
          </button>
        </p>
      )}

      {state === 'idle' && (
        <p className="text-slate-500 text-xs mt-1">Formatos: .csv, .xlsx, .xls</p>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
