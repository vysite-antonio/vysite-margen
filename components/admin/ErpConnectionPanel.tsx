'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  upsertErpConnection,
  updateErpConnectionPassword,
  toggleErpConnection,
  testErpConnection,
  triggerErpSync,
} from '@/lib/actions/erp-connection'
import type { DbType, ConnStatus } from '@/lib/actions/erp-connection'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ExistingConnection {
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
  clientId:   string
  connection: ExistingConnection | null
  syncLogs:   SyncLog[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DB_TYPES: { value: DbType; label: string; defaultPort: number; icon: string }[] = [
  { value: 'sqlserver', label: 'SQL Server (MSSQL)', defaultPort: 1433, icon: '🪟' },
  { value: 'mysql',     label: 'MySQL / MariaDB',    defaultPort: 3306, icon: '🐬' },
  { value: 'postgres',  label: 'PostgreSQL',          defaultPort: 5432, icon: '🐘' },
  { value: 'sqlite',    label: 'SQLite (archivo)',    defaultPort: 0,    icon: '📄' },
]

const STATUS_CONFIG: Record<ConnStatus, { label: string; color: string; dot: string }> = {
  active:   { label: 'Activo',    color: 'text-emerald-400 bg-emerald-950/40 border-emerald-700/50', dot: 'bg-emerald-400' },
  error:    { label: 'Error',     color: 'text-red-400 bg-red-950/40 border-red-700/50',             dot: 'bg-red-400' },
  pending:  { label: 'Pendiente', color: 'text-amber-400 bg-amber-950/40 border-amber-700/50',       dot: 'bg-amber-400' },
  disabled: { label: 'Desactivado', color: 'text-slate-400 bg-slate-800/40 border-slate-700/50',    dot: 'bg-slate-500' },
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ErpConnectionPanel({ clientId, connection, syncLogs }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showForm, setShowForm] = useState(!connection)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Form state
  const [dbType, setDbType]     = useState<DbType>(connection?.db_type ?? 'sqlserver')
  const [host, setHost]         = useState(connection?.host ?? '')
  const [port, setPort]         = useState(String(connection?.port ?? 1433))
  const [dbName, setDbName]     = useState(connection?.database_name ?? '')
  const [user, setUser]         = useState(connection?.username ?? '')
  const [pass, setPass]         = useState('')
  const [sqlTable, setSqlTable] = useState(String(connection?.meta?.sql_table ?? ''))
  const [interval, setInterval] = useState(String(connection?.sync_interval_hours ?? 24))
  const [changePass, setChangePass] = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Guardar configuración ─────────────────────────────────────────────────
  function handleSave() {
    if (!host || !dbName || !user) { showToast('Host, base de datos y usuario son obligatorios', false); return }
    if (!connection && !pass) { showToast('La contraseña es obligatoria para nueva conexión', false); return }

    startTransition(async () => {
      const { ok, error } = await upsertErpConnection(clientId, {
        db_type:             dbType,
        host:                host.trim(),
        port:                parseInt(port) || 1433,
        database_name:       dbName.trim(),
        username:            user.trim(),
        password:            pass || '%%KEEP%%',  // si vacío y ya existe, actualizar sin contraseña
        sync_interval_hours: parseInt(interval) || 24,
        sql_table:           sqlTable.trim(),
      })
      if (!ok) { showToast(error ?? 'Error al guardar', false); return }

      // Si hay nueva contraseña explícita, actualizarla
      if (connection && changePass && pass) {
        await updateErpConnectionPassword(clientId, pass)
      }

      showToast('Configuración guardada')
      setShowForm(false)
      setPass('')
      setChangePass(false)
      router.refresh()
    })
  }

  // ── Probar conexión ───────────────────────────────────────────────────────
  function handleTest() {
    setTestResult(null)
    startTransition(async () => {
      const result = await testErpConnection(clientId)
      setTestResult({ ok: result.ok, msg: result.message })
    })
  }

  // ── Sincronizar ahora ─────────────────────────────────────────────────────
  function handleSync() {
    setSyncResult(null)
    startTransition(async () => {
      const result = await triggerErpSync(clientId)
      setSyncResult({ ok: result.ok, msg: result.message })
      if (result.ok) router.refresh()
    })
  }

  // ── Toggle activar/desactivar ─────────────────────────────────────────────
  function handleToggle(enable: boolean) {
    startTransition(async () => {
      const { ok, error } = await toggleErpConnection(clientId, enable)
      if (!ok) { showToast(error ?? 'Error', false); return }
      showToast(enable ? 'Conexión activada' : 'Conexión desactivada')
      router.refresh()
    })
  }

  const statusCfg = connection ? STATUS_CONFIG[connection.status] : null

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl
          ${toast.ok ? 'bg-emerald-950 border-emerald-700 text-emerald-300' : 'bg-red-950 border-red-700 text-red-300'}`}>
          {toast.ok ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Estado actual (si existe) */}
      {connection && !showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">

          {/* Header estado */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{DB_TYPES.find(d => d.value === connection.db_type)?.icon ?? '🗄️'}</div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {connection.database_name}
                  <span className="text-slate-500 font-normal"> @ </span>
                  {connection.host}:{connection.port}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {DB_TYPES.find(d => d.value === connection.db_type)?.label} · usuario: {connection.username}
                  {connection.meta?.sql_table ? ` · tabla: ${connection.meta.sql_table}` : ''}
                </p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5 shrink-0 ${statusCfg?.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg?.dot}`} />
              {statusCfg?.label}
            </span>
          </div>

          {/* Error */}
          {connection.last_error && (
            <div className="bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
              <p className="text-red-400 text-xs font-medium">Último error:</p>
              <p className="text-red-300 text-xs mt-0.5 font-mono">{connection.last_error}</p>
            </div>
          )}

          {/* Sync info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-slate-500 text-xs">Última sync</p>
              <p className="text-slate-200 text-sm font-medium mt-0.5">
                {connection.last_sync_at
                  ? new Date(connection.last_sync_at).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                  : 'Nunca'}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-slate-500 text-xs">Próxima sync</p>
              <p className="text-slate-200 text-sm font-medium mt-0.5">
                {connection.next_sync_at
                  ? new Date(connection.next_sync_at).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                  : `Cada ${connection.sync_interval_hours}h`}
              </p>
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium border
              ${testResult.ok ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300' : 'bg-red-950/40 border-red-700/50 text-red-300'}`}>
              {testResult.msg}
            </div>
          )}

          {/* Sync result */}
          {syncResult && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium border
              ${syncResult.ok ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300' : 'bg-red-950/40 border-red-700/50 text-red-300'}`}>
              {syncResult.msg}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={isPending || connection.status === 'disabled'}
              className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-40 transition-colors"
            >
              {isPending ? '…' : '🔌 Probar conexión'}
            </button>
            <button
              onClick={handleSync}
              disabled={isPending || connection.status === 'disabled'}
              className="text-xs px-3 py-2 rounded-lg border border-emerald-700/60 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
            >
              {isPending ? '…' : '⚡ Sincronizar ahora'}
            </button>
            {connection.status === 'disabled' ? (
              <button
                onClick={() => handleToggle(true)}
                disabled={isPending}
                className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-700/60 disabled:opacity-40 transition-colors"
              >
                ▶ Activar sync automática
              </button>
            ) : (
              <button
                onClick={() => handleToggle(false)}
                disabled={isPending}
                className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-500 hover:text-amber-400 hover:border-amber-700/60 disabled:opacity-40 transition-colors"
              >
                ⏸ Desactivar sync
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors ml-auto"
            >
              ✏️ Editar
            </button>
          </div>
        </div>
      )}

      {/* Formulario de configuración */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">
              {connection ? 'Editar conexión SQL' : 'Configurar conexión SQL directa'}
            </h3>
            {connection && (
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
                Cancelar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Tipo de BD */}
            <div className="sm:col-span-2">
              <label className="text-slate-400 text-xs mb-2 block">Motor de base de datos</label>
              <div className="flex flex-wrap gap-2">
                {DB_TYPES.map(db => (
                  <button
                    key={db.value}
                    onClick={() => { setDbType(db.value); setPort(String(db.defaultPort)) }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors
                      ${dbType === db.value
                        ? 'bg-emerald-500/20 border-emerald-600 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
                  >
                    <span>{db.icon}</span>
                    <span>{db.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Host */}
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Host / IP del servidor</label>
              <input
                type="text" placeholder="192.168.1.10 o servidor.empresa.com"
                value={host} onChange={e => setHost(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
              />
            </div>

            {/* Puerto */}
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Puerto</label>
              <input
                type="number" placeholder="1433"
                value={port} onChange={e => setPort(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Base de datos */}
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Nombre de la base de datos</label>
              <input
                type="text" placeholder="PCCOM_empresa"
                value={dbName} onChange={e => setDbName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
              />
            </div>

            {/* Tabla SQL */}
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">
                Tabla de ventas
                <span className="text-slate-600 ml-1">(opcional si perfil ERP es PCCOM)</span>
              </label>
              <input
                type="text" placeholder="LineasVenta, AlbVenLin, ventas…"
                value={sqlTable} onChange={e => setSqlTable(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
              />
            </div>

            {/* Usuario */}
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Usuario (solo lectura)</label>
              <input
                type="text" placeholder="vysite_readonly"
                value={user} onChange={e => setUser(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">
                Contraseña
                {connection && (
                  <button
                    onClick={() => setChangePass(!changePass)}
                    className="text-emerald-500 hover:text-emerald-400 ml-2 text-[11px] transition-colors"
                  >
                    {changePass ? '(cancelar cambio)' : '(cambiar)'}
                  </button>
                )}
              </label>
              {(!connection || changePass) ? (
                <input
                  type="password" placeholder="contraseña"
                  value={pass} onChange={e => setPass(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              ) : (
                <p className="text-slate-600 text-xs py-2">••••••••••• (cifrada en Supabase)</p>
              )}
            </div>

            {/* Intervalo de sync */}
            <div className="sm:col-span-2">
              <label className="text-slate-400 text-xs mb-1.5 block">Intervalo de sincronización automática</label>
              <div className="flex flex-wrap gap-2">
                {[6, 12, 24, 48, 168].map(h => (
                  <button
                    key={h}
                    onClick={() => setInterval(String(h))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                      ${interval === String(h)
                        ? 'bg-emerald-500/20 border-emerald-600 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}
                  >
                    {h < 24 ? `${h}h` : h === 24 ? '1 día' : h === 48 ? '2 días' : '1 semana'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aviso de seguridad */}
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2.5 flex gap-2">
            <span className="text-amber-400 text-sm shrink-0">🔒</span>
            <p className="text-amber-300/80 text-xs">
              La contraseña se cifra con AES-256-GCM antes de almacenarse. El usuario debe tener permisos de <strong>solo lectura</strong> en las tablas de ventas.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar conexión'}
          </button>
        </div>
      )}

      {/* Historial de sincronizaciones */}
      {syncLogs.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wide">Historial de sincronizaciones</h4>
          </div>
          <div className="divide-y divide-slate-800/60">
            {syncLogs.map(log => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0
                  ${log.status === 'success' ? 'bg-emerald-950/60 text-emerald-400' :
                    log.status === 'error'   ? 'bg-red-950/60 text-red-400' :
                                              'bg-amber-950/60 text-amber-400'}`}>
                  {log.status === 'success' ? '✓' : log.status === 'error' ? '✕' : '…'}
                </span>
                <span className="text-slate-400 text-xs flex-1 min-w-0 truncate">
                  {new Date(log.started_at).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  {log.rows_processed != null && ` · ${log.rows_processed} filas`}
                  {log.error_message && <span className="text-red-400 ml-1">— {log.error_message}</span>}
                </span>
                {log.finished_at && (
                  <span className="text-slate-600 text-xs shrink-0">
                    {Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
