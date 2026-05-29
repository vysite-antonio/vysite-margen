'use client'

import { useState } from 'react'
import type { KPIs, PlanTier, ClientConfig, CycleStatus } from '@/types'

interface Alert {
  id:       string
  type:     'warning' | 'danger' | 'info'
  icon:     string
  title:    string
  message:  string
  action?:  { label: string; href: string }
}

interface Props {
  kpis:     KPIs | null
  plan:     PlanTier
  config:   ClientConfig
  cycle:    { status: CycleStatus; created_at: string } | null
  stripeStatus?: string | null
}

// ─── Lógica de alertas ────────────────────────────────────────────────────────

function computeAlerts(props: Props): Alert[] {
  const { kpis, plan, config, cycle, stripeStatus } = props
  const alerts: Alert[] = []
  const configAny = config as unknown as Record<string, unknown>
  const margins = configAny.margins as Record<string, number> | undefined

  // 1. Pago pendiente / suscripción vencida
  if (stripeStatus === 'past_due') {
    alerts.push({
      id: 'past_due',
      type: 'danger',
      icon: '💳',
      title: 'Pago pendiente',
      message: 'Hay un problema con el pago de tu suscripción. Actualiza tu método de pago para mantener el acceso.',
      action: { label: 'Gestionar facturación', href: '/billing' },
    })
  }

  // 2. Margen real por debajo del objetivo configurado
  if (kpis && margins) {
    const margenReal = kpis.margen_porcentaje  // ya en %
    // Calcular margen objetivo promedio de las categorías configuradas
    const values = Object.values(margins)
    const avgObjetivo = values.length
      ? (values.reduce((a, b) => a + (b <= 1 ? b * 100 : b), 0) / values.length)
      : 0

    if (avgObjetivo > 0 && margenReal < avgObjetivo * 0.85) {
      // Más de un 15% por debajo del objetivo
      alerts.push({
        id: 'margen_bajo',
        type: 'danger',
        icon: '📉',
        title: 'Margen por debajo del objetivo',
        message: `Tu margen actual es ${margenReal.toFixed(1)}%, significativamente por debajo de tu objetivo (${avgObjetivo.toFixed(1)}%). Revisa las oportunidades detectadas.`,
        action: plan !== 'inicio' ? { label: 'Ver oportunidades', href: '#oportunidades' } : undefined,
      })
    } else if (avgObjetivo > 0 && margenReal < avgObjetivo) {
      alerts.push({
        id: 'margen_bajo_leve',
        type: 'warning',
        icon: '⚠️',
        title: 'Margen ligeramente por debajo del objetivo',
        message: `Tu margen actual (${margenReal.toFixed(1)}%) está por debajo de tu objetivo (${avgObjetivo.toFixed(1)}%).`,
      })
    }
  }

  // 3. Potencial de mejora alto sin acción
  if (kpis && kpis.potencial_mensual > 5000) {
    alerts.push({
      id: 'potencial_alto',
      type: 'info',
      icon: '🎯',
      title: `${kpis.potencial_mensual.toLocaleString('es-ES')} € de margen recuperable`,
      message: `Hemos detectado ${kpis.total_oportunidades} oportunidades de mejora en tu cuenta. Prioriza las de mayor impacto.`,
    })
  }

  // 4. Ciclo sin analizar hace más de 20 días
  if (cycle) {
    const daysSinceCreated = (Date.now() - new Date(cycle.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (['esperando_csv', 'csv_recibido'].includes(cycle.status) && daysSinceCreated > 20) {
      alerts.push({
        id: 'ciclo_pendiente',
        type: 'warning',
        icon: '⏳',
        title: 'Ciclo pendiente de análisis',
        message: `Tienes un ciclo abierto desde hace ${Math.floor(daysSinceCreated)} días. Sube tu CSV para obtener el análisis.`,
        action: { label: 'Subir CSV', href: '#drive' },
      })
    }
  }

  // 5. Sin ciclos activos y onboarding completado (llevan tiempo sin analizar)
  if (!cycle && configAny.onboarding_completed) {
    alerts.push({
      id: 'sin_ciclo',
      type: 'info',
      icon: '📊',
      title: 'Sin análisis activo',
      message: 'No tienes ningún ciclo de análisis en curso. Solicita uno nuevo para ver tus métricas actualizadas.',
    })
  }

  return alerts
}

// ─── Componente ───────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  danger:  { bar: 'bg-red-500',    bg: 'bg-red-950/40',    border: 'border-red-800/50',    title: 'text-red-300',    msg: 'text-red-400',    btn: 'text-red-400 hover:text-red-300 border-red-700/50 hover:border-red-600' },
  warning: { bar: 'bg-amber-500',  bg: 'bg-amber-950/30',  border: 'border-amber-800/40',  title: 'text-amber-300',  msg: 'text-amber-500',  btn: 'text-amber-400 hover:text-amber-300 border-amber-700/50 hover:border-amber-600' },
  info:    { bar: 'bg-emerald-500',bg: 'bg-emerald-950/30',border: 'border-emerald-800/40',title: 'text-emerald-300',msg: 'text-emerald-500',btn: 'text-emerald-400 hover:text-emerald-300 border-emerald-700/50 hover:border-emerald-600' },
}

export default function AlertsBanner(props: Props) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const alerts = computeAlerts(props).filter(a => !dismissed.includes(a.id))

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2 mb-6">
      {alerts.map(alert => {
        const s = TYPE_STYLES[alert.type]
        return (
          <div key={alert.id} className={`relative flex items-start gap-3 rounded-xl border px-4 py-3 ${s.bg} ${s.border} overflow-hidden`}>
            {/* Barra lateral de color */}
            <div className={`absolute left-0 inset-y-0 w-1 ${s.bar} rounded-l-xl`} />

            <span className="text-lg shrink-0 ml-1">{alert.icon}</span>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${s.title}`}>{alert.title}</p>
              <p className={`text-xs mt-0.5 leading-relaxed ${s.msg}`}>{alert.message}</p>
              {alert.action && (
                <a href={alert.action.href}
                  className={`inline-block mt-2 text-xs border px-2.5 py-1 rounded-lg transition-colors ${s.btn}`}>
                  {alert.action.label} →
                </a>
              )}
            </div>

            <button
              onClick={() => setDismissed(d => [...d, alert.id])}
              className="text-slate-600 hover:text-slate-400 text-xs shrink-0 mt-0.5 transition-colors"
              aria-label="Cerrar alerta"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
