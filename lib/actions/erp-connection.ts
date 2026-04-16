'use server'

import { createClient } from '@/lib/supabase/server'
import { captureError } from '@/lib/monitoring.server'

// ─── Cifrado AES-256-GCM (Web Crypto, disponible en Node 18+ / Edge Runtime) ──

const KEY_HEX = process.env.ERP_ENCRYPTION_KEY ?? ''

async function getKey(): Promise<CryptoKey> {
  if (KEY_HEX.length !== 64) {
    throw new Error('ERP_ENCRYPTION_KEY debe ser exactamente 64 caracteres hex (32 bytes)')
  }
  const raw = hexToBytes(KEY_HEX)
  return crypto.subtle.importKey('raw', raw.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return b
}
function b64(buf: ArrayBuffer) { return Buffer.from(buf).toString('base64') }
function fromB64(s: string)    { return Buffer.from(s, 'base64') }

async function encryptPassword(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv  = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return `${b64(iv.buffer)}:${b64(ct)}`
}

async function decryptPassword(stored: string): Promise<string> {
  const key = await getKey()
  const [ivB64, ctB64] = stored.split(':')
  if (!ivB64 || !ctB64) throw new Error('Formato cifrado inválido')
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    key,
    fromB64(ctB64)
  )
  return new TextDecoder().decode(pt)
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DbType = 'mysql' | 'postgres' | 'sqlserver' | 'sqlite'
export type ConnStatus = 'active' | 'error' | 'pending' | 'disabled'

export interface ErpConnectionInput {
  db_type:             DbType
  host:                string
  port:                number
  database_name:       string
  username:            string
  password:            string   // en claro — se cifra antes de guardar
  sync_interval_hours: number
  sql_table?:          string   // tabla principal a consultar
}

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getErpConnection(clientId: string): Promise<{
  connection: (Omit<ErpConnectionInput, 'password'> & {
    id: string; status: ConnStatus; last_sync_at: string | null;
    next_sync_at: string | null; last_error: string | null; meta: Record<string, unknown>
  }) | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('erp_connections')
      .select('id,db_type,host,port,database_name,username,sync_interval_hours,status,last_sync_at,next_sync_at,last_error,meta')
      .eq('client_id', clientId)
      .single()

    if (error && error.code === 'PGRST116') return { connection: null, error: null } // not found
    if (error) throw error
    return { connection: data as never, error: null }
  } catch (err) {
    await captureError(err, { module: 'erp-connection/get', client_id: clientId })
    return { connection: null, error: 'Error al cargar la conexión ERP' }
  }
}

export async function getErpSyncLogs(clientId: string, limit = 10): Promise<{
  logs: { id: string; started_at: string; finished_at: string | null; status: string; rows_processed: number | null; error_message: string | null }[]
}> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('erp_sync_logs')
      .select('id,started_at,finished_at,status,rows_processed,error_message')
      .eq('client_id', clientId)
      .order('started_at', { ascending: false })
      .limit(limit)
    return { logs: (data ?? []) as never }
  } catch {
    return { logs: [] }
  }
}

// ─── Crear / actualizar conexión ──────────────────────────────────────────────

export async function upsertErpConnection(
  clientId: string,
  input: ErpConnectionInput
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createClient()

    // Solo admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'No autenticado' }
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (role?.role !== 'admin') return { ok: false, error: 'Sin permisos' }

    const encPass = await encryptPassword(input.password)

    const meta = { sql_table: input.sql_table ?? '' }

    const { error } = await supabase
      .from('erp_connections')
      .upsert({
        client_id:           clientId,
        db_type:             input.db_type,
        host:                input.host,
        port:                input.port,
        database_name:       input.database_name,
        username:            input.username,
        encrypted_password:  encPass,
        sync_interval_hours: input.sync_interval_hours,
        status:              'pending',
        meta,
      }, { onConflict: 'client_id' })

    if (error) throw error
    return { ok: true, error: null }
  } catch (err) {
    await captureError(err, { module: 'erp-connection/upsert', client_id: clientId })
    return { ok: false, error: 'Error al guardar la conexión' }
  }
}

export async function updateErpConnectionPassword(
  clientId: string,
  newPassword: string
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    // Solo admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'No autenticado' }
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (role?.role !== 'admin') return { ok: false, error: 'Sin permisos' }

    const encPass  = await encryptPassword(newPassword)
    const { error } = await supabase
      .from('erp_connections')
      .update({ encrypted_password: encPass, status: 'pending' })
      .eq('client_id', clientId)
    if (error) throw error
    return { ok: true, error: null }
  } catch (err) {
    await captureError(err, { module: 'erp-connection/password', client_id: clientId })
    return { ok: false, error: 'Error al actualizar contraseña' }
  }
}

export async function toggleErpConnection(
  clientId: string,
  enabled: boolean
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    // Solo admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'No autenticado' }
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (role?.role !== 'admin') return { ok: false, error: 'Sin permisos' }

    const { error } = await supabase
      .from('erp_connections')
      .update({ status: enabled ? 'pending' : 'disabled' })
      .eq('client_id', clientId)
    if (error) throw error
    return { ok: true, error: null }
  } catch (err) {
    await captureError(err, { module: 'erp-connection/toggle', client_id: clientId })
    return { ok: false, error: 'Error al cambiar estado' }
  }
}

// ─── Probar conexión (llama a la Edge Function con test_only=true) ─────────────

export async function testErpConnection(clientId: string): Promise<{
  ok: boolean; message: string
}> {
  try {
    const supabase   = await createClient()
    // Solo admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'No autenticado' }
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (role?.role !== 'admin') return { ok: false, message: 'Sin permisos' }

    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const res = await fetch(`${projectUrl}/functions/v1/sync-erp-database`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ client_id: clientId, test_only: true }),
    })

    const data = await res.json()
    if (!res.ok || data.error) return { ok: false, message: data.error ?? 'Error desconocido' }
    return { ok: true, message: 'Conexión exitosa ✅' }
  } catch (err) {
    await captureError(err, { module: 'erp-connection/test', client_id: clientId })
    return { ok: false, message: `Error: ${(err as Error).message}` }
  }
}

// ─── Sincronizar ahora ────────────────────────────────────────────────────────

export async function triggerErpSync(clientId: string): Promise<{
  ok: boolean; message: string; rows?: number
}> {
  try {
    // Solo admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'No autenticado' }
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (role?.role !== 'admin') return { ok: false, message: 'Sin permisos' }

    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const res = await fetch(`${projectUrl}/functions/v1/sync-erp-database`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ client_id: clientId }),
    })

    const data = await res.json()
    if (!res.ok || data.error) return { ok: false, message: data.error ?? 'Error de sincronización' }
    return { ok: true, message: `Sincronizado: ${data.rows} filas procesadas`, rows: data.rows }
  } catch (err) {
    await captureError(err, { module: 'erp-connection/sync', client_id: clientId })
    return { ok: false, message: `Error: ${(err as Error).message}` }
  }
}
