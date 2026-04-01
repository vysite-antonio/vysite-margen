'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface Props {
  data: Array<{ categoria: string; margen_pct: number; facturacion: number }>
}

function getBarColor(margen: number): string {
  if (margen >= 30) return '#10b981'  // emerald
  if (margen >= 20) return '#f59e0b'  // amber
  if (margen >= 10) return '#f97316'  // orange
  return '#ef4444'                     // red
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const d1 = payload[1]
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 shadow-xl min-w-[140px]">
      <p className="text-white text-xs font-semibold mb-2">{label}</p>
      <p className="text-slate-300 text-xs">
        Margen: <span className="text-white font-semibold">{d?.value?.toFixed(1)}%</span>
      </p>
      {d1 && (
        <p className="text-slate-300 text-xs mt-0.5">
          Facturación: <span className="text-white font-semibold">{(d1.value as number)?.toLocaleString('es-ES')} €</span>
        </p>
      )}
    </div>
  )
}

export default function MargenChart({ data }: Props) {
  if (!data?.length) return null

  const sorted = [...data].sort((a, b) => b.margen_pct - a.margen_pct)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white font-semibold text-sm">Margen por categoría</h2>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/> ≥30%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"/> ≥20%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/> &lt;20%</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 42)}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
          barSize={14}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, Math.max(...sorted.map(d => d.margen_pct)) * 1.15]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="categoria"
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
          <Bar dataKey="margen_pct" radius={[0, 4, 4, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={getBarColor(entry.margen_pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
