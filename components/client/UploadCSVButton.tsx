'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  clientId: string
  cycleId: string
}

export default function UploadCSVButton({ clientId, cycleId }: Props) {
  const [uploading, setUploading] = useState(false)
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
    setUploading(true)
    setError(null)
    const filePath = `${clientId}/${cycleId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('csv-uploads')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }
    await supabase.from('uploaded_files').insert({
      cycle_id: cycleId,
      client_id: clientId,
      file_name: file.name,
      file_path: filePath,
      file_size_bytes: file.size,
      file_type: file.type || 'text/csv',
      is_active: true,
    })
    await supabase.from('analysis_cycles').update({ status: 'csv_recibido' }).eq('id', cycleId)
    await supabase.from('system_logs').insert({
      action: 'csv_subido',
      client_id: clientId,
      details: { file_name: file.name, cycle_id: cycleId },
    })
    setUploading(false)
    router.refresh()
  }

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
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white disabled:text-slate-500 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        {uploading ? 'Subiendo...' : 'Seleccionar archivo CSV'}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <p className="text-slate-500 text-xs mt-1">Formatos: .csv, .xlsx, .xls</p>
    </div>
  )
}
