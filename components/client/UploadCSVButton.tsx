'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  clientId: string
  cycleId: string
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const STATE_LABELS: Record<UploadState, string> = {
  idle:       'Seleccionar archivo CSV',
  uploading:  'Subiendo archivo…',
  processing: 'Analizando datos…',
  done:       'Análisis iniciado',
  error:      'Error al subir',
}

export default function UploadCSVButton({ clientId, cycleId }: Props) {
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

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

    // ── 4. Disparar procesado automático ────────────────────────────────
    setState('processing')

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
      // El procesado es best-effort; si falla el admin puede reprocesar
      console.warn('[UploadCSVButton] No se pudo disparar procesado automático')
    }

    setState('done')

    // Polling cada 3s para detectar cuando el ciclo pase a "completado"
    const poll = setInterval(() => router.refresh(), 3000)
    setTimeout(() => clearInterval(poll), 90_000)
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
          El análisis puede tardar 30–60 segundos. La página se actualizará automáticamente.
        </p>
      )}

      {state === 'done' && (
        <p className="text-emerald-400 text-xs mt-2">
          ✓ Archivo recibido · Análisis en proceso
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
