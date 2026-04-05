'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'

// ─── Mock data ───────────────────────────────────────────────────────────────

const margenData = [
  { categoria: 'Vinos',     margen: 34.2 },
  { categoria: 'Cervezas',  margen: 28.7 },
  { categoria: 'Destilados',margen: 41.5 },
  { categoria: 'Refrescos', margen: 22.1 },
  { categoria: 'Aguas',     margen: 18.4 },
]

const oportunidadesData = [
  { name: 'Alta rentabilidad',  value: 38, color: '#10b981' },
  { name: 'Volumen estancado',  value: 27, color: '#f59e0b' },
  { name: 'Bajo margen',        value: 21, color: '#ef4444' },
  { name: 'Sin clasificar',     value: 14, color: '#6b7280' },
]

const tendenciaData = [
  { mes: 'Oct', margen: 26.1 },
  { mes: 'Nov', margen: 27.4 },
  { mes: 'Dic', margen: 25.8 },
  { mes: 'Ene', margen: 28.3 },
  { mes: 'Feb', margen: 30.1 },
  { mes: 'Mar', margen: 31.6 },
]

const comercialesData = [
  { nombre: 'Ana G.',    visitas: 24, pedidos: 18, margen: 33.1 },
  { nombre: 'Carlos M.', visitas: 31, pedidos: 22, margen: 36.4 },
  { nombre: 'Laura P.',  visitas: 19, pedidos: 14, margen: 29.8 },
  { nombre: 'David R.',  visitas: 28, pedidos: 20, margen: 31.2 },
]

// ─── Custom tooltip helpers ───────────────────────────────────────────────────

interface TipProps { active?: boolean; payload?: Array<{ value?: number; name?: string }>; label?: string }

function MargenTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-emerald-400 font-semibold">{(payload[0].value as number).toFixed(1)}% margen</p>
    </div>
  )
}

function TendenciaTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-cyan-400 font-semibold">{(payload[0].value as number).toFixed(1)}%</p>
    </div>
  )
}

function DonutTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-300 font-semibold">{payload[0].name}</p>
      <p className="text-white">{payload[0].value}%</p>
    </div>
  )
}

// ─── Pain stat card ───────────────────────────────────────────────────────────

function StatCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
      <p className="text-3xl font-bold text-emerald-400 mb-1">{value}</p>
      <p className="text-white font-semibold text-sm mb-2">{label}</p>
      <p className="text-slate-400 text-xs leading-relaxed">{sub}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const supabase = createClient()

  // Login state
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading]   = useState(false)
  const [loginError, setLoginError]       = useState('')

  // Contact form state
  const [form, setForm] = useState({ nombre: '', empresa: '', email: '', telefono: '', mensaje: '' })
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [formError, setFormError] = useState('')

  // ── Login ──────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
    if (error) {
      setLoginError('Email o contraseña incorrectos')
      setLoginLoading(false)
      return
    }
    router.push('/dashboard')
  }

  // ── Contact form ───────────────────────────────────────────────────────────
  async function handleContact(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.email) { setFormError('Nombre y email son obligatorios'); return }
    setSending(true)
    setFormError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('error')
      setSent(true)
    } catch {
      setFormError('No se pudo enviar el formulario. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/60 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">VM</span>
            </div>
            <span className="text-white font-semibold">Vysite Margen</span>
          </div>
          <a
            href="#login"
            className="text-sm bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Acceder
          </a>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium px-4 py-2 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Para distribuidores Horeca
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
          Cada visita sin datos es{' '}
          <span className="text-emerald-400">margen que pierdes</span>
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Tus comerciales entran al cliente sin saber qué productos tienen margen negativo,
          cuáles no se han pedido en 60 días o qué rutas no son rentables.
          Vysite Margen lo pone todo en pantalla, en tiempo real.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#contacto"
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Quiero una demo
          </a>
          <a
            href="#panel"
            className="border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Ver el panel
          </a>
        </div>
      </section>

      {/* ── Pain stats ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            value="23%"
            label="Margen perdido por falta de datos"
            sub="El comercial negocia sin saber el coste real del producto que está vendiendo."
          />
          <StatCard
            value="41%"
            label="Rutas con rentabilidad desconocida"
            sub="Más de 4 de cada 10 rutas no tienen visibilidad de si generan o destruyen margen."
          />
          <StatCard
            value="67 días"
            label="Tiempo medio sin detectar un producto parado"
            sub="Casi 10 semanas antes de que nadie se dé cuenta de que un SKU dejó de moverse."
          />
        </div>
      </section>

      {/* ── Mock dashboard preview ─────────────────────────────────────────── */}
      <section id="panel" className="bg-slate-900/50 border-y border-slate-800 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">El panel que tus comerciales necesitan</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Datos reales de tu cartera: margen por categoría, oportunidades detectadas automáticamente
              y seguimiento del rendimiento de cada ruta.
            </p>
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Margen por categoría */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <p className="text-sm font-semibold text-slate-300 mb-1">Margen por categoría</p>
              <p className="text-xs text-slate-500 mb-5">% margen bruto — últimos 30 días</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={margenData} barSize={28}>
                  <XAxis dataKey="categoria" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 50]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<MargenTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="margen" radius={[6, 6, 0, 0]}>
                    {margenData.map((entry, i) => (
                      <Cell key={i} fill={entry.margen >= 30 ? '#10b981' : entry.margen >= 25 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Oportunidades donut */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <p className="text-sm font-semibold text-slate-300 mb-1">Oportunidades detectadas</p>
              <p className="text-xs text-slate-500 mb-5">Clasificación automática de clientes</p>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie
                      data={oportunidadesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {oportunidadesData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2">
                  {oportunidadesData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-slate-400">{item.name}</span>
                      <span className="text-xs text-white font-semibold ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Tendencia */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <p className="text-sm font-semibold text-slate-300 mb-1">Tendencia de margen</p>
              <p className="text-xs text-slate-500 mb-5">Evolución mensual — últimos 6 meses</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={tendenciaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} domain={[20, 36]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<TendenciaTip />} />
                  <Line type="monotone" dataKey="margen" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: '#06b6d4', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Comerciales */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <p className="text-sm font-semibold text-slate-300 mb-1">Rendimiento de comerciales</p>
              <p className="text-xs text-slate-500 mb-5">Visitas, pedidos y margen medio</p>
              <div className="space-y-3">
                {comercialesData.map((c) => (
                  <div key={c.nombre} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 font-semibold flex-shrink-0">
                      {c.nombre.split(' ')[0][0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-300 font-medium">{c.nombre}</span>
                        <span className="text-xs text-emerald-400 font-semibold">{c.margen}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${(c.pedidos / c.visitas) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">{c.pedidos}/{c.visitas}</p>
                      <p className="text-xs text-slate-600">pedidos</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Cómo funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Conecta tus datos',
              desc: 'Importa tu cartera de clientes y productos desde tu ERP o por CSV. Listo en menos de 10 minutos.',
              icon: '📥',
            },
            {
              step: '02',
              title: 'El sistema calcula',
              desc: 'Vysite Margen analiza márgenes, detecta oportunidades y genera alertas automáticas por ruta y producto.',
              icon: '⚡',
            },
            {
              step: '03',
              title: 'Tu comercial actúa',
              desc: 'Antes de entrar al cliente, el comercial ya sabe qué decir, qué proponer y qué evitar para cerrar con margen.',
              icon: '🎯',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl mx-auto mb-4">
                {item.icon}
              </div>
              <p className="text-xs text-emerald-400 font-mono font-semibold mb-2">{item.step}</p>
              <h3 className="text-white font-semibold mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonial / Quote ─────────────────────────────────────────────── */}
      <section className="bg-slate-900/50 border-y border-slate-800 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xl md:text-2xl text-slate-200 leading-relaxed mb-6">
            &ldquo;Antes el comercial salía con una lista de precios. Ahora sale con inteligencia:
            sabe qué cliente tiene margen negativo, qué producto no se ha pedido en 3 meses
            y qué oferta tiene sentido proponer.&rdquo;
          </p>
          <p className="text-slate-400 text-sm">Director comercial · Distribuidor Horeca · 280 clientes activos</p>
        </div>
      </section>

      {/* ── Login + Contact ─────────────────────────────────────────────────── */}
      <section id="contacto" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* Login */}
          <div id="login">
            <h2 className="text-2xl font-bold mb-2">¿Ya eres cliente?</h2>
            <p className="text-slate-400 text-sm mb-6">Accede a tu panel de Vysite Margen.</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="tu@empresa.es"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Contraseña</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              {loginError && (
                <p className="text-red-400 text-xs">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {loginLoading ? 'Entrando…' : 'Acceder al panel'}
              </button>
            </form>
          </div>

          {/* Contact form */}
          <div>
            <h2 className="text-2xl font-bold mb-2">Solicita una demo</h2>
            <p className="text-slate-400 text-sm mb-6">
              Te mostramos cómo quedaría con tus datos reales. Sin compromiso.
            </p>

            {sent ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
                <p className="text-3xl mb-3">✅</p>
                <p className="text-emerald-400 font-semibold mb-1">¡Mensaje recibido!</p>
                <p className="text-slate-400 text-sm">Te contactaremos en menos de 24 horas.</p>
              </div>
            ) : (
              <form onSubmit={handleContact} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Tu nombre"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Empresa</label>
                    <input
                      type="text"
                      value={form.empresa}
                      onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                      placeholder="Tu distribuidora"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="contacto@empresa.es"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Teléfono</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="600 000 000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">¿Cuál es tu mayor problema ahora mismo?</label>
                  <textarea
                    rows={3}
                    value={form.mensaje}
                    onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
                    placeholder="Ej: no sé qué rutas son rentables, mis comerciales no tienen datos antes de la visita…"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  />
                </div>
                {formError && (
                  <p className="text-red-400 text-xs">{formError}</p>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {sending ? 'Enviando…' : 'Solicitar demo gratuita'}
                </button>
                <p className="text-slate-600 text-xs text-center">
                  Sin compromisos. Te respondemos en menos de 24 h.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">VM</span>
            </div>
            <span className="text-slate-400 text-sm">Vysite Margen</span>
          </div>
          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()} Vysite · Inteligencia comercial para distribuidores Horeca
          </p>
          <a href="mailto:comercial@vysite.es" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
            comercial@vysite.es
          </a>
        </div>
      </footer>
    </div>
  )
}
