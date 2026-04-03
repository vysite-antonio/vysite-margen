import Link from 'next/link'
import { PLAN_PRICING } from '@/lib/stripe'
import PricingCards from '@/components/PricingCards'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <span className="text-white font-medium text-sm">Vysite Margen</span>
          </div>
          <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">
            Acceder →
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">
            Planes para distribuidores Horeca
          </h1>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Empieza gratis y escala según tus necesidades de análisis comercial.
          </p>
        </div>

        <PricingCards plans={PLAN_PRICING} isLoggedIn={false} currentPlan="inicio" />

        <p className="text-center text-slate-600 text-xs mt-10">
          Sin permanencia. Cancela cuando quieras. Precios con IVA incluido.
        </p>
      </main>
    </div>
  )
}
