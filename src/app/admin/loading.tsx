/** Affiché dès le clic, pendant que la page admin se charge : la navigation répond immédiatement. */
export default function ChargementAdmin() {
  return (
    <div className="flex min-w-0 flex-1 flex-col" aria-busy="true" aria-label="Chargement de la page">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
          <div className="h-7 w-56 animate-pulse rounded-lg bg-slate-200/80" />
          <div className="mt-2.5 h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl space-y-5 px-5 py-6 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/70" />
          ))}
        </div>
        <div className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3.5 flex-1 animate-pulse rounded bg-slate-100" />
              <div className="h-3.5 w-16 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
