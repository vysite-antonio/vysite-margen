'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface Props {
  oport: {
    categoria_perdida: number
    mix_suboptimo: number
    cliente_caida: number
    producto_no_ofrecido: number
  }
  potencialTotal: number
}

const CONFIG = [
  { key: 'mix_suboptimo',        label: 'Mix subóptimo',      color: '#3b82f6' },
  { key: 'categoria_perdida',    label: 'Categoría perdida',  color: '#f97316' },
  { key: 'producto_no_ofrecido', label: 'Prod. no ofrecido',  color: '#a855f7' },
  { key: 'cliente_caida',        label: 'Cliente en caída',   color: '#ef4444' },
]

// Tooltip personalizado
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-white text-xs font-semibold">{d.name}</p>
      <p className="text-slate-300 text-xs mt-0.5">{d.value} oportunidades</p>
    </div>
  )
}

function CustomLegend({ payload }: any) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {payload?.map((entry: any) => (
        <li key={entry.value} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-400 text-xs">{entry.value}</span>
        </li>
      ))}
    </ul>
  )
}

export default function OportunidadesDonut({ oport, potencialTotal }: Props) {
  const data = CONFIG
    .map(c => ({ name: c.label, value: oport[c.key as keyof typeof oport] ?? 0, color: c.color }))
    .filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) return null

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-sm">Distribución de oportunidades</h2>
          <p className="text-slate-500 text-xs mt-0.5">{total} acciones identificadas</p>
        </div>
        {potencialTotal > 0 && (
          <div className="text-right">
            <p className="text-emerald-400 font-bold text-lg tabular-nums">
              {potencialTotal.toLocaleString('es-ES')} €
            </p>
            <p className="text-slate-500 text-xs">potencial/mes</p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Número central */}
      <div className="relative" style={{ marginTop: -175, marginBottom: 130, pointerEvents: 'none' }}>
        <div className="flex flex-col items-center justify-center" style={{ height: 180 }}>
          <span className="text-white text-3xl font-bold tabular-nums">{total}</span>
          <span className="text-slate-500 text-xs">acciones</span>
        </div>
      </div>
    </div>
  )
}
