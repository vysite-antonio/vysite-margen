'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'

interface ComercialSales {
  nombre_erp: string
  n_clientes: number
  facturacion: number
  margen_pct: number
  potencial_mes: number
  pendiente?: number
  tasa_cobro?: number
}

interface Props {
  comerciales: ComercialSales[]
  displayNames?: Record<string, string>
  pipeline?: string
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 shadow-xl min-w-[160px]">
      <p className="text-white text-xs font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs mt-0.5" style={{ color: p.fill }}>
          {p.name}: <span className="text-white font-semibold tabular-nums">{(p.value as number)?.toLocaleString('es-ES')} €</span>
        </p>
      ))}
    </div>
  )
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex justify-center gap-5 mt-2">
      {payload?.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-400 text-xs">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ComercialesChart({ comerciales, displayNames = {}, pipeline }: Props) {
  if (!comerciales?.length) return null

  const isFacturas = pipeline === 'facturas'
  const sorted = [...comerciales].sort((a, b) => b.facturacion - a.facturacion).slice(0, 8)

  const chartData = sorted.map(c => ({
    name: displayNames[c.nombre_erp] ?? c.nombre_erp,
    Facturación: c.facturacion,
    ...(isFacturas
      ? { Pendiente: c.pendiente ?? 0 }
      : { Potencial: c.potencial_mes * 12 }  // anualizado para que sea comparable
    ),
    n_clientes: c.n_clientes,
    margen_pct: c.margen_pct,
  }))

  const maxVal = Math.max(...chartData.flatMap(d => [d.Facturación, (d as any).Pendiente ?? (d as any).Potencial ?? 0]))

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-white font-semibold text-sm">Facturación por comercial</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {isFacturas ? 'Facturado vs pendiente de cobro' : 'Facturación total vs potencial anualizado'}
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 55)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          barSize={12}
          barGap={3}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, maxVal * 1.1]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
          <Legend content={<CustomLegend />} />
          <Bar dataKey="Facturación" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          {isFacturas
            ? <Bar dataKey="Pendiente" fill="#ef4444" radius={[0, 4, 4, 0]} />
            : <Bar dataKey="Potencial" fill="#10b981" radius={[0, 4, 4, 0]} />
          }
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
