'use client'

import { useState } from 'react'
import ErpConnectionPanel from '@/components/admin/ErpConnectionPanel'
import UpdateKPIsForm from '@/components/admin/UpdateKPIsForm'
import type { ConnStatus } from '@/lib/actions/erp-connection'

// ─── Props ────────────────────────────────────────────────────────────────────

import type { DbType } from '@/lib/actions/erp-connection'

interface ErpConnection {
  id:                  string
  db_type:             DbType
  host:                string
  port:                number
  database_name:       string
  username:            string
  sync_interval_hours: number
  status:              ConnStatus
  last_sync_at:        string | null
  next_sync_at:        string | null
  last_error:          string | null
  meta:                Record<string, unknown>
}

interface SyncLog {
  id:             string
  started_at:     string
  finished_at:    string | null
  status:         string
  rows_processed: number | null
  error_message:  string | null
}

interface Props {
  clientId:     string
  // CSV
  latestCycle:  any | null
  kpis:         any | null
  // SQL
  erpConnection: ErpConnection | null
  syncLogs:      SyncLog[]
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DataIngestionTabs({
  clientId,
  latestCycle,
  kpis,
  erpConnection,
  syncLogs,
}: Props) {
  const hasSqlActive = erpConnection?.status === 'active'
  const [tab, setTab] = useState<'csv' | 'sql'>(hasSqlActive ? 'sql' : 'csv')

  return (
    <div>
      {/* Tab selector */}
      <div className="flex border-b border-slate-800">
        <TabBtn
          active={tab === 'csv'}
          onClick={() => setTab('csv')}
          icon="📄"
          label="Carga manual (CSV)"
          badge={latestCycle ? 'ciclo activo' : undefined}
          badgeColor="amber"
        />
        <TabBtn
          active={tab === 'sql'}
          onClick={() => setTab('sql')}
          icon="⚡"
          label="Conexión automática (SQL)"
          badge={hasSqlActive ? 'conectado' : erpConnection ? erpConnection.status : undefined}
          badgeColor={hasSqlActive ? 'emerald' : 'slate'}
        />
      </div>

      {/* ── CSV tab ──────────────────────────────────────────────────────────── */}
      {tab === 'csv' && (
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <span className="text-2xl">📄</span>
            <div>
              <p className="text-white text-sm font-medium">Carga manual de CSV</p>
              <p className="text-slate-400 text-xs mt-0.5">
                El cliente exporta los datos desde su ERP y los sube aquí. Compatible con todos los sistemas.
                {hasSqlActive && (
                  <span className="text-emerald-400 ml-1">
                    La conexión SQL está activa — el CSV puede usarse como carga puntual adicional.
                  </span>
                )}
              </p>
            </div>
          </div>

          {latestCycle ? (
            <div className="space-y-5">
              {/* Archivos CSV */}
              <div>
                <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">
                  Archivos CSV del cliente
                </h3>
                {latestCycle.uploaded_files?.length > 0 ? (
                  <div className="space-y-2">
                    {latestCycle.uploaded_files.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">📄</span>
                          <div>
                            <p className="text-white text-sm">{file.file_name}</p>
                            <p className="text-slate-500 text-xs">
                              {new Date(file.uploaded_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                            </p>
                          </div>
                        </div>
                        <a
                          href={`/api/download?path=${encodeURIComponent(file.file_path)}&bucket=csv-uploads`}
                          className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                        >
                          Descargar
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-lg p-4 text-center">
                    <p className="text-slate-500 text-sm">El cliente aún no ha subido CSV en este ciclo</p>
                  </div>
                )}
              </div>

              {/* KPIs */}
              <div>
                <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">KPIs del análisis</h3>
                <UpdateKPIsForm cycleId={latestCycle.id} clientId={clientId} existingKpis={kpis} />
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-6 text-center">
              <p className="text-slate-500 text-sm">No hay ciclo activo. Crea un ciclo para activar la carga CSV.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SQL tab ──────────────────────────────────────────────────────────── */}
      {tab === 'sql' && (
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-white text-sm font-medium">Conexión SQL directa</p>
              <p className="text-slate-400 text-xs mt-0.5">
                Vysite Margen se conecta directamente a la BD del ERP del cliente — igual que Power BI.
                Solo lectura, sincronización automática programada.
                {latestCycle && (
                  <span className="text-slate-500 ml-1">
                    El CSV sigue siendo válido como carga puntual adicional.
                  </span>
                )}
              </p>
            </div>
          </div>

          <ErpConnectionPanel
            clientId={clientId}
            connection={erpConnection}
            syncLogs={syncLogs}
          />
        </div>
      )}
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active, onClick, icon, label, badge, badgeColor,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
  badge?: string
  badgeColor?: 'emerald' | 'amber' | 'slate'
}) {
  const badgeStyles = {
    emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50',
    amber:   'bg-amber-950/60 text-amber-400 border-amber-700/50',
    slate:   'bg-slate-800 text-slate-500 border-slate-700',
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors
        ${active
          ? 'border-emerald-500 text-white'
          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge && (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyles[badgeColor ?? 'slate']}`}>
          {badge}
        </span>
      )}
    </button>
  )
}
