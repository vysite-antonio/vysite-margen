const Sk = ({ w, h = 'h-3' }: { w: string; h?: string }) => (
  <div className={`${h} ${w} bg-slate-800 rounded animate-pulse`} />
)

export default function ComercialLoading() {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-slate-800 rounded-md animate-pulse" />
            <Sk w="w-28" h="h-4" />
          </div>
          <Sk w="w-20" h="h-8" />
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse space-y-3">
              <Sk w="w-28" />
              <Sk w="w-12" h="h-7" />
            </div>
          ))}
        </div>
        <Sk w="w-24" h="h-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Sk w="w-44" h="h-4" />
                  <Sk w="w-56" />
                </div>
                <Sk w="w-20" h="h-5" />
              </div>
              <div className="flex gap-4 pt-3 border-t border-slate-800">
                <Sk w="w-32" /><Sk w="w-20" /><Sk w="w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
