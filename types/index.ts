// ============================================================
// VYSITE MARGEN — Types & Interfaces
// ============================================================

// 'comercial' está preparado en el tipo pero requiere ALTER en Supabase user_roles CHECK constraint antes de usarse (B4)
export type UserRole = 'admin' | 'client' | 'comercial'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
}

// ─── Módulo de objetivos (Item 6) ─────────────────────────────────────────────

export interface ClientGoals {
  /** Margen objetivo global (%) — alertar si actual < este valor */
  margen_objetivo_pct?: number
  /** Facturación mensual objetivo (€) */
  facturacion_objetivo_mes?: number
  /** Potencial mínimo a perseguir cada mes (€) — alerta si cae por debajo */
  potencial_minimo_mes?: number
  /** Texto libre con notas o compromisos del cliente */
  notas?: string
}

export interface ClientConfig {
  erp: string
  encoding: string
  decimal_separator: string
  delivery_day_1: number
  delivery_day_2: number
  /** Objetivos comerciales del cliente (módulo de alertas) */
  goals?: ClientGoals
  margins: {
    Limpieza: number
    Drogueria: number
    Menaje: number
    Alimentacion: number
    Bebidas: number
    Fresco: number
    Otros: number
    [key: string]: number
  }
  // Mapeo columnas CSV del ERP → campos internos
  column_mapping: {
    fecha: string
    cliente_codigo: string
    cliente_nombre: string
    categoria: string
    comercial: string
    cantidad: string
    margen: string
    importe_total: string
    producto_codigo: string
    producto_nombre: string
    [key: string]: string
  }
  // Mapeo categorías ERP → categorías internas
  category_mapping: Record<string, string>
  // Mapeo nombres ERP de comerciales → nombres a mostrar en el dashboard
  comercial_display_names?: Record<string, string>
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
  validation_result: ValidationResult
  is_active: boolean
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

// ─── KPIs extended data (stored in kpis.extended_data JSONB) ─────────────────

export type OportunidadTipo = 'categoria_perdida' | 'mix_suboptimo' | 'cliente_caida' | 'producto_no_ofrecido'

export interface KPIsExtendedData {
  // Identifica el pipeline usado: 'lineas_venta' | 'facturas'
  pipeline?: string

  // ── Pipeline: líneas de venta ─────────────────────────────────────────────
  margen_por_categoria?: Array<{
    categoria: string
    margen_pct: number
    facturacion: number
  }>
  oportunidades_detalle?: Array<{
    cliente_codigo: string
    cliente_nombre: string
    tipo: OportunidadTipo
    potencial_mes: number
  }>
  comerciales?: Array<{
    nombre_erp: string
    n_clientes: number
    facturacion: number
    margen_pct: number
    potencial_mes: number
    // campos extra del pipeline facturas (opcionales):
    pendiente?: number
    n_facturas?: number
    tasa_cobro?: number
  }>
  riesgo?: Array<{
    cliente_codigo: string
    cliente_nombre: string
    severidad: 'CRITICO' | 'ATENCION' | 'SEGUIMIENTO'
    caida_pct: number
    impacto_mes: number
  }>

  // ── Pipeline: facturas (cabeceras) ────────────────────────────────────────
  resumen_cobro?: {
    total_facturado: number
    total_cobrado: number
    total_pendiente: number
    tasa_cobro_pct: number
    n_facturas: number
  }
  top_clientes?: Array<{
    cliente_codigo: string
    cliente_nombre: string
    comercial: string
    facturacion: number
    pendiente: number
    n_facturas: number
    tasa_cobro: number
  }>
  tendencia_mensual?: Array<{
    mes: string
    facturacion: number
  }>
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
  extended_data: KPIsExtendedData
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

// ─── Plan tiers ────────────────────────────────────────────────────────────────

export type PlanTier = 'inicio' | 'crecimiento' | 'estrategico'

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  inicio: 'Plan Inicio',
  crecimiento: 'Plan Crecimiento',
  estrategico: 'Plan Estratégico',
}

// ─── Módulos de análisis (B3 FOMO) ────────────────────────────────────────────

export interface AnalysisModule {
  id: string
  name: string
  display_name: string
  plan_required: PlanTier
  prompt_template: Record<string, unknown> | null
  config_schema: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export interface ClientModuleConfig {
  id: string
  client_id: string
  module_id: string
  is_enabled: boolean
  custom_params: Record<string, unknown> | null
  display_order: number
  created_at: string
}

// ─── Validación CSV (uploaded_files.validation_result) ───────────────────────

export interface ValidationResult {
  is_valid: boolean
  warnings: string[]
  row_count: number
  missing_columns: string[]
  detected_columns: string[]
  detected_encoding: string
  detected_separator: string
}

export const REPORT_TYPE_ICONS: Record<ReportType, string> = {
  oportunidades: '🎯',
  comerciales: '👤',
  dashboard: '📊',
}

// ─── Tipos de query para el panel de admin ─────────────────────────────────────

export interface SystemLog {
  id: string
  action: string
  user_id: string | null
  client_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

/** KPIs anidados en ciclos del panel admin */
export interface AdminCycleKpi {
  potencial_mensual: number
  total_oportunidades: number
}

/** Ciclo anidado en el query de admin */
export interface AdminCycleRow {
  id: string
  status: CycleStatus
  period_start: string
  period_end: string
  updated_at: string
  created_at: string
  uploaded_files: Array<{ id: string; uploaded_at: string }>
  reports: Array<{ id: string }>
  kpis: AdminCycleKpi[]
}

/** Cliente con ciclos anidados, tal como lo devuelve el query de admin */
export interface AdminClientRow {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  plan: PlanTier
  is_active: boolean
  analysis_cycles: AdminCycleRow[]
}

/** Ciclo resumido para las estadísticas globales de admin */
export interface AdminStatCycle {
  status: CycleStatus
  kpis: Array<{ potencial_mensual: number }>
}

// ─── Tipos de query para el dashboard de comercial ────────────────────────────

export interface ComercialAssignment {
  client_id: string
}

export interface ComercialCycleKpi {
  potencial_mensual: number
  margen_porcentaje: number
  facturacion_total: number
}

export interface ComercialCycleRow {
  id: string
  status: CycleStatus
  period_start: string
  period_end: string
  updated_at: string
  kpis: ComercialCycleKpi[]
}

export interface ComercialClientRow {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  plan: PlanTier
  analysis_cycles: ComercialCycleRow[]
}

