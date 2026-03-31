export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header skeleton */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-slate-800 rounded-md animate-pulse" />
            <div>
              <div className="h-3.5 w-32 bg-slate-800 rounded animate-pulse mb-1.5" />
              <div className="h-2.5 w-20 bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-20 bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Ciclo skeleton */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="h-4 w-36 bg-slate-800 rounded mb-2" />
              <div className="h-3 w-48 bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-24 bg-slate-800 rounded-full" />
          </div>
          <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center">
            <div className="h-8 w-8 bg-slate-800 rounded mx-auto mb-3" />
            <div className="h-4 w-40 bg-slate-800 rounded mx-auto mb-2" />
            <div className="h-3 w-56 bg-slate-800 rounded mx-auto mb-4" />
            <div className="h-9 w-36 bg-slate-800 rounded-lg mx-auto" />
          </div>
        </div>

        {/* Hero KPI skeleton */}
        <div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 mb-4 animate-pulse">
            <div className="h-3 w-32 bg-slate-800 rounded mb-3" />
            <div className="h-12 w-52 bg-slate-800 rounded mb-2" />
            <div className="h-3 w-44 bg-slate-800 rounded" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
                <div className="h-2.5 w-20 bg-slate-800 rounded mb-3" />
                <div className="h-7 w-24 bg-slate-800 rounded mb-2" />
                <div className="h-2 w-16 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Oportunidades skeleton */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse">
          <div className="h-4 w-40 bg-slate-800 rounded mb-5" />
          <div className="space-y-5">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="h-3 w-36 bg-slate-800 rounded" />
                  <div className="h-3 w-20 bg-slate-800 rounded" />
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full">
                  <div
                    className="h-full bg-slate-700 rounded-full"
                    style={{ width: `${[70, 45, 30, 15][i]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
