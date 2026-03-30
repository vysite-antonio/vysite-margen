export type QualityGrade = 'A' | 'B' | 'C'

export interface QualityCheck {
  key: string
  label: string
  passed: boolean
  impact: 'high' | 'medium' | 'low'
  tip?: string
}

export interface QualityScore {
  grade: QualityGrade
  score: number
  checks: QualityCheck[]
  summary: string
  improvement: string
}

const OPTIONAL_COLUMNS = [
  { key: 'comercial', label: 'Columna de comercial/vendedor', aliases: ['comercial', 'vendedor', 'agente', 'representante', 'ruta'], impact: 'high' as const, tip: 'Añade una columna COMERCIAL en tu ERP para análisis por vendedor', scoreValue: 25 },
  { key: 'categoria', label: 'Columna de categoría/familia', aliases: ['categoria', 'familia', 'grupo', 'division', 'seccion', 'departamento'], impact: 'high' as const, tip: 'Exporta la columna FAMILIA de tu ERP para detectar oportunidades por categoría', scoreValue: 25 },
  { key: 'producto_codigo', label: 'Código de producto', aliases: ['cod_articulo', 'referencia', 'ref', 'codigo', 'id_producto', 'sku'], impact: 'medium' as const, tip: 'Incluye el código de artículo para rastrear productos específicos', scoreValue: 15 },
  { key: 'margen', label: 'Columna de margen o coste', aliases: ['margen', 'beneficio', 'coste', 'precio_coste', 'pvp_compra', 'margen_bruto'], impact: 'medium' as const, tip: 'Si tu ERP exporta el coste, el análisis de margen será exacto', scoreValue: 20 },
  { key: 'cantidad', label: 'Columna de unidades/cantidad', aliases: ['cantidad', 'unidades', 'qty', 'bultos', 'cajas'], impact: 'low' as const, tip: 'Incluye las unidades vendidas para análisis de volumen', scoreValue: 10 },
]

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_')
}

export function calculateQualityScore(headers: string[], rows: Record<string, string>[], rowCount: number): QualityScore {
  const normalizedHeaders = headers.map(normalizeHeader)
  const checks: QualityCheck[] = []
  let totalScore = 0

  const hasEnoughRows = rowCount >= 50
  checks.push({ key: 'row_count', label: `Volumen de datos (${rowCount.toLocaleString('es-ES')} filas)`, passed: hasEnoughRows, impact: 'medium', tip: hasEnoughRows ? undefined : 'El CSV parece incompleto. Exporta al menos 90 días de ventas.' })
  if (hasEnoughRows) totalScore += 5

  for (const col of OPTIONAL_COLUMNS) {
    const found = col.aliases.some(alias => normalizedHeaders.some(h => h.includes(alias)))
    checks.push({ key: col.key, label: col.label, passed: found, impact: col.impact, tip: found ? undefined : col.tip })
    if (found) totalScore += col.scoreValue
  }

  const grade: QualityGrade = totalScore >= 80 ? 'A' : totalScore >= 50 ? 'B' : 'C'
  const topImprovement = checks.filter(c => !c.passed && c.tip).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.impact] - { high: 0, medium: 1, low: 2 }[b.impact]))[0]

  return {
    grade, score: totalScore, checks,
    summary: { A: 'Excelente. Datos completos para análisis óptimo.', B: 'Bueno. Añade más columnas para mejorar la precisión.', C: 'Básico. El análisis será limitado sin más datos.' }[grade],
    improvement: topImprovement?.tip || 'No hay mejoras adicionales disponibles.',
  }
}

