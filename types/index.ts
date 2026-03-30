// ============================================================
// VYSITE MARGEN — Types & Interfaces
// ============================================================

export type UserRole = 'admin' | 'client'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
}

export interface ClientConfig {
  margins: {
    Limpieza: number
    Droguería: number
    Menaje: number
    Alimentación: number
    Bebidas: number
    Fresco: number
    Otros: number
    [key: string]: number
  }
  category_mapping: Record<string, string>
  erp: string
  delivery_day_1: number
  delivery_day_2: number
}

export interface Client {
  id: string
  user_id: string
  company_name: string
  contact_name: string
  contact_email: string
  config: ClientConfig
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CycleStatus =
  | 'esperando_csv'
  | 'csv_recibido'
  | 'procesando'
  | 'completado'
  | 'cancelado'

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  esperando_csv: 'Esperando CSV',
  csv_recibido: 'CSV Recibido',
  procesando: 'Procesando',
  completado: 'Completado',
  cancelado: 'Cancelado',
}

export const CYCLE_STATUS_COLORS: Record<CycleStatus, string> = {
  esperando_csv: 'text-amber-600 bg-amber-50 border-amber-200',
  csv_recibido: 'text-blue-600 bg-blue-50 border-blue-200',
  procesando: 'text-purple-600 bg-purple-50 border-purple-200',
  completado: 'text-green-600 bg-green-50 border-green-200',
  cancelado: 'text-gray-500 bg-gray-50 border-gray-200',
}

export interface AnalysisCycle {
  id: string
  client_id: string
  period_start: string
  period_end: string
  status: CycleStatus
  admin_notes?: string
  created_at: string
  updated_at: string
}

export interface UploadedFile {
  id: string
  cycle_id: string
  client_id: string
  file_name: string
  file_path: string
  file_size_bytes?: number
  file_type: string
  processing_status: 'pendiente' | 'procesado' | 'error'
  processing_metadata: Record<string, unknown>
  uploaded_at: string
}

export type ReportType = 'oportunidades' | 'comerciales' | 'dashboard'

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  oportunidades: 'Informe de Oportunidades',
  comerciales: 'Análisis Comerciales',
  dashboard: 'Dashboard Ejecutivo',
}

export interface Report {
  id: string
  cycle_id: string
  client_id: string
  report_type: ReportType
  file_name: string
  file_path: string
  uploaded_by?: string
  uploaded_at: string
}

export interface KPIs {
  id: string
  cycle_id: string
  client_id: string
  total_oportunidades: number
  potencial_mensual: number
  potencial_anual: number
  facturacion_total: number
  margen_total: number
  margen_porcentaje: number
  clientes_activos: number
  top_categoria?: string
  categoria_mayor_potencial?: string
  oportunidades_por_tipo: {
    categoria_perdida: number
    mix_suboptimo: number
    cliente_caida: number
    producto_no_ofrecido: number
  }
  extended_data: Record<string, unknown>
  source: 'manual' | 'automatico'
  created_at: string
  updated_at: string
}

export interface CreateClientForm {
  company_name: string
  contact_name: string
  contact_email: string
  password: string
  erp?: string
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export const REPORT_TYPE_ICONS: Record<ReportType, string> = {
  oportunidades: '🎯',
  comerciales: '👤',
  dashboard: '📊',
}

