'use client'

import type { KPIs } from '@/types'

interface Props {
  kpis: KPIs
  companyName: string
  periodStart?: string
  periodEnd?: string
}

export default function ExportKPIsButton({ kpis, companyName, periodStart, periodEnd }: Props) {
  const handleExport = () => {
    const period = periodStart && periodEnd
      ? `${new Date(periodStart).toLocaleDateString('es-ES')} - ${new Date(periodEnd).toLocaleDateString('es-ES')}`
      : 'sin período'

    const rows = [
      ['Métrica', 'Valor'],
      ['Empresa', companyName],
      ['Período', period],
      [''],
      ['Potencial mensual (€)', kpis.potencial_mensual],
      ['Potencial anual (€)', kpis.potencial_anual],
      ['Facturación total (€)', kpis.facturacion_total],
      ['Margen total (€)', kpis.margen_total],
      ['Margen (%)', kpis.margen_porcentaje],
      ['Clientes activos', kpis.clientes_activos],
      ['Oportunidades totales', kpis.total_oportunidades],
      ['Top categoría margen', kpis.top_categoria ?? ''],
      ['Categoría mayor potencial', kpis.categoria_mayor_potencial ?? ''],
      [''],
      ['Desglose oportunidades', ''],
      ['Categoría perdida', kpis.oportunidades_por_tipo?.categoria_perdida ?? 0],
      ['Mix subóptimo', kpis.oportunidades_por_tipo?.mix_suboptimo ?? 0],
      ['Cliente en caída', kpis.oportunidades_por_tipo?.cliente_caida ?? 0],
      ['Producto no ofrecido', kpis.oportunidades_por_tipo?.producto_no_ofrecido ?? 0],
    ]

    const csv = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n')

    const bom = '﻿'  // BOM para compatibilidad con Excel en español
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vysite-kpis-${companyName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors"
      title="Exportar KPIs como CSV"
    >
      <span>⬇</span>
      <span className="hidden sm:inline">Exportar</span>
    </button>
  )
}
