'use client'
import { useRouter } from 'next/navigation'
import type React from 'react'
import type { CycleStatus } from '@/types'
import { CYCLE_STATUS_LABELS } from '@/types'
import { updateCycleStatus } from '@/lib/actions/cycles'

const STATUSES: CycleStatus[] = ['esperando_csv', 'csv_recibido', 'procesando', 'completado']

export default function UpdateCycleStatus({
  cycleId,
  currentStatus,
}: {
  cycleId: string
  currentStatus: CycleStatus
}) {
  const router = useRouter()

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as CycleStatus
    const { error } = await updateCycleStatus(cycleId, newStatus, currentStatus)
    if (!error) router.refresh()
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
    >
      {STATUSES.map(s => (
        <option key={s} value={s}>{CYCLE_STATUS_LABELS[s]}</option>
      ))}
    </select>
  )
}
