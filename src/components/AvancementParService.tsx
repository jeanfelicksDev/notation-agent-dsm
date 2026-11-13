'use client'

import { ChevronRight } from 'lucide-react'
import type { AvancementService } from '@/lib/avancement-service'

type Props = {
  services: AvancementService[]
  /** Service dont les non-soumis sont affichés dans le détail, s'il y en a un. */
  serviceActif: string | null
  onChoisir: (service: string) => void
}

const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? 's' : ''}`

/** Onglet Suivi : taux de soumission des évaluations par service ; un clic liste les évaluateurs qui n'ont pas tout soumis. */
export default function AvancementParService({ services, serviceActif, onChoisir }: Props) {
  const restantesTotal = services.reduce((n, s) => n + s.restantes, 0)

  return (
    <section aria-labelledby="avancement-service-titre" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h3 id="avancement-service-titre" className="text-lg font-semibold text-slate-900">
            Soumissions par service
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Évaluations soumises par les notants de chaque service, cadres compris. Cliquez sur un service pour voir qui n’a pas encore soumis.
          </p>
        </div>
        {restantesTotal > 0 && (
          <p className="text-xs font-semibold text-amber-800 tabular-nums">
            {restantesTotal} {pluriel(restantesTotal, 'évaluation')} {pluriel(restantesTotal, 'non soumise')}
          </p>
        )}
      </div>

      {services.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Aucun évaluateur interne n’est encore affecté.</p>
      ) : (
        <ul className="mt-4 space-y-1">
          {services.map((s) => (
            <li key={s.service}>
              <LigneService avancement={s} actif={s.service === serviceActif} onChoisir={onChoisir} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LigneService({ avancement: s, actif, onChoisir }: { avancement: AvancementService; actif: boolean; onChoisir: (service: string) => void }) {
  const complet = s.restantes === 0
  const titre = complet
    ? `${s.service} : toutes les évaluations sont soumises`
    : `${s.restantes} ${pluriel(s.restantes, 'évaluation')} ${pluriel(s.restantes, 'non soumise')} : voir les évaluateurs de ${s.service} concernés`

  return (
    <button
      type="button"
      disabled={complet}
      aria-pressed={actif}
      onClick={() => onChoisir(s.service)}
      title={titre}
      className={`group w-full grid grid-cols-[minmax(0,9rem)_1fr_auto] sm:grid-cols-[minmax(0,13rem)_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 disabled:cursor-default ${
        actif ? 'bg-navy-50 ring-1 ring-navy-200' : 'enabled:hover:bg-slate-50'
      }`}
    >
      <span className={`truncate ${actif ? 'font-semibold text-navy-900' : 'text-slate-700'}`}>{s.service}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <span className={`block h-full rounded-full ${complet ? 'bg-emerald-500' : 'bg-navy-700'}`} style={{ width: `${s.taux}%` }} />
      </span>
      <span className="flex items-center justify-end gap-2 tabular-nums">
        <span className="w-20 text-right">
          <strong className="font-semibold text-navy-900">{s.taux}%</strong>
          <span className="ml-1.5 text-xs text-slate-400">
            {s.soumises}/{s.total}
          </span>
        </span>
        <span
          className={`hidden sm:inline-flex w-28 items-center justify-end gap-0.5 text-xs font-semibold ${
            complet ? 'text-emerald-700' : 'text-amber-800'
          }`}
        >
          {complet ? 'Complet' : `${s.restantes} ${pluriel(s.restantes, 'non soumise')}`}
          {!complet && <ChevronRight className="h-3.5 w-3.5 opacity-50 transition-opacity group-hover:opacity-100" aria-hidden />}
        </span>
      </span>
    </button>
  )
}
