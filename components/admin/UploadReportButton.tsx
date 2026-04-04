'use client'
import { useState, useRef } from 'react'
import type React from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { ReportType } from '@/types'

interface Props { cycleId: string; clientId: string; reportType: ReportType; existingReportId?: string }

export default function UploadReportButton({ cycleId, clientId, reportType, existingReportId }: Props) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const filePath = `${clientId}/${cycleId}/${reportType}_${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('reports').upload(filePath, file, { upsert: false })
    if (!uploadError) {
      const payload = { cycle_id: cycleId, client_id: clientId, report_type: reportType, file_name: file.name, file_path: filePath }
      if (existingReportId) { await supabase.from('reports').update(payload).eq('id', existingReportId) }
      else { await supabase.from('reports').insert(payload) }
      await supabase.from('system_logs').insert({ action: 'informe_subido', client_id: clientId, details: { report_type: reportType, file_name: file.name, cycle_id: cycleId } })
      router.refresh()
    }
    setUploading(false)
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.pdf" onChange={handleFile} className="hidden"/>
      <button onClick={() => inputRef.current?.click()} disabled={uploading}
        className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
        {uploading ? '...' : existingReportId ? 'Reemplazar' : 'Subir'}
      </button>
    </>
  )
}

