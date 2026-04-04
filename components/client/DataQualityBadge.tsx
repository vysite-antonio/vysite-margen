'use client'
import type { QualityScore } from '@/lib/dataQuality'

export default function DataQualityBadge({ quality }: { quality: QualityScore }) {
  const colors = { A: 'text-emerald-400', B: 'text-amber-400', C: 'text-red-400' }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`font-bold text-lg ${colors[quality.grade]}`}>{quality.grade}</span>
      <span className="text-slate-400">{quality.summary}</span>
    </div>
  )
}
