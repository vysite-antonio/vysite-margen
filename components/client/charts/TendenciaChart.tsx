'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
interface TooltipContentProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

interface Props {
  data: Array<{ mes: string; facturacion: number }>
  label?: string
}

function formatMes(mes: string): string {
  // Intenta parsear YYYY-MM o MM-YYYY
  const parts = mes.split('-')
  if (parts.length < 2) return mes
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  if (parts[0].length === 4) {
    // YYYY-MM
    const m = parseInt(parts[1]) - 1
    return `${months[m] ?? parts[1]}`
  } else {
    // MM-YYYY
    const m = parseInt(parts[0]) - 1
    return `${months[m] ?? parts[0]}`
  }
}

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{formatMes(label ?? '')}</p>
      <p className="text-white text-sm font-semibold tabular-nums">
        {(payload[0]?.value as number)?.toLocaleString('es-ES')} €
      </p>
    </div>
  )
}

export default function TendenciaChart({ data, label = 'Facturación mensual' }: Props) {
  if (!data?.length) return null

  const sorted = [...data].sort((a, b) => a.mes.localeCompare(b.mes))
  const chartData = sorted.map(d => ({ ...d, mesLabel: formatMes(d.mes) }))
  const maxVal = Math.max(...chartData.map(d => d.facturacion))

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-white font-semibold text-sm mb-5">{label}</h2>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradFact" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="mesLabel"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
            width={40}
            domain={[0, maxVal * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="facturacion"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gradFact)"
            dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
