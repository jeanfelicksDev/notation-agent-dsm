'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { PointJour, TauxService } from '@/lib/participation'

type Participation = { services: TauxService[]; jours: PointJour[]; notantsAttendus: number }
type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; donnees: Participation }

interface ParticipationModalProps {
  onClose: () => void
}

/** Modal de la page d'accueil : participation des pairs et clients internes, par service et jour par jour. */
export function ParticipationModal({ onClose }: ParticipationModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()

    const controleur = new AbortController()
    fetch('/api/stats/public/participation', { signal: controleur.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((donnees: Participation) => setEtat({ statut: 'pret', donnees }))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setEtat({ statut: 'erreur' })
      })
    return () => controleur.abort()
  }, [])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-labelledby="participation-titre"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl animate-rise-in overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-overlay backdrop:bg-navy-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 pt-5 pb-4 sm:px-7">
        <div>
          <h2 id="participation-titre" className="text-lg font-semibold text-navy-900">
            Pairs et clients internes
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Taux de soumission des évaluations de la campagne en cours</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="-mr-2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="px-6 py-6 sm:px-7">
        {etat.statut === 'chargement' && (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Chargement…
          </p>
        )}
        {etat.statut === 'erreur' && (
          <p className="py-16 text-center text-sm text-slate-500">La participation n’a pas pu être chargée. Réessayez dans un instant.</p>
        )}
        {etat.statut === 'pret' && (
          <div className="space-y-8">
            <ParService services={etat.donnees.services} />
            <ParJour jours={etat.donnees.jours} notantsAttendus={etat.donnees.notantsAttendus} />
          </div>
        )}
      </div>
    </dialog>
  )
}

function TitreSection({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">{children}</h3>
}

function ParService({ services }: { services: TauxService[] }) {
  return (
    <section>
      <TitreSection>Par service</TitreSection>
      {services.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Aucune évaluation n’est encore affectée.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {services.map((s) => (
            <li key={s.service} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
              <span className="truncate text-slate-700" title={s.service}>
                {s.service}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <span className="block h-full rounded-full bg-navy-700" style={{ width: `${s.taux}%` }} />
              </span>
              <span className="w-24 text-right tabular-nums">
                <strong className="font-semibold text-navy-900">{s.taux}%</strong>
                <span className="ml-1.5 text-xs text-slate-400">
                  {s.soumises}/{s.total}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ─── Courbe jour par jour ─── */

const L = 640
const H = 230
const MARGE = { haut: 14, droite: 42, bas: 30, gauche: 34 }
const LARGEUR_UTILE = L - MARGE.gauche - MARGE.droite
const HAUTEUR_UTILE = H - MARGE.haut - MARGE.bas
const MAX_ETIQUETTES_JOUR = 8

const formatJour = (jour: string, mois: 'numeric' | 'long' = 'numeric') =>
  new Date(`${jour}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: mois, timeZone: 'UTC' })

function ParJour({ jours, notantsAttendus }: { jours: PointJour[]; notantsAttendus: number }) {
  const [survol, setSurvol] = useState<number | null>(null)

  if (jours.length === 0) {
    return (
      <section>
        <TitreSection>Jour après jour</TitreSection>
        <p className="mt-3 text-sm text-slate-500">La campagne n’a pas encore commencé.</p>
      </section>
    )
  }

  const maxNotants = Math.max(1, ...jours.map((j) => j.notants))
  const pas = LARGEUR_UTILE / jours.length
  const largeurBarre = Math.max(2, Math.min(28, pas * 0.6))
  const x = (i: number) => MARGE.gauche + pas * (i + 0.5)
  const yNotants = (n: number) => MARGE.haut + HAUTEUR_UTILE * (1 - n / maxNotants)
  const yTaux = (t: number) => MARGE.haut + HAUTEUR_UTILE * (1 - t / 100)
  const intervalleEtiquettes = Math.ceil(jours.length / MAX_ETIQUETTES_JOUR)
  const courbe = jours.map((j, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yTaux(j.taux).toFixed(1)}`).join(' ')
  const actif = jours[survol ?? jours.length - 1]

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <TitreSection>Jour après jour</TitreSection>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-navy-700" aria-hidden />
            Notants du jour
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-gold-500" aria-hidden />
            Taux de participation cumulé
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600" aria-live="polite">
        <strong className="font-semibold text-navy-900">{formatJour(actif.jour, 'long')}</strong>
        {' · '}
        {actif.notants} notant{actif.notants > 1 ? 's' : ''} {actif.notants > 1 ? 'ont' : 'a'} soumis
        {' · '}
        participation à <strong className="font-semibold text-gold-700">{actif.taux}%</strong>
      </p>

      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="mt-2 w-full touch-none select-none"
        role="img"
        aria-label={`Notants par jour et taux de participation cumulé, sur ${jours.length} jours`}
        onPointerLeave={() => setSurvol(null)}
      >
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={yTaux(t)} y2={yTaux(t)} className="stroke-slate-100" />
            <text x={L - MARGE.droite + 8} y={yTaux(t)} dy="0.35em" className="fill-gold-700 text-[11px] tabular-nums">
              {t}%
            </text>
          </g>
        ))}
        {[0, maxNotants].map((n) => (
          <text key={n} x={MARGE.gauche - 8} y={yNotants(n)} dy="0.35em" textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
            {n}
          </text>
        ))}

        {jours.map((j, i) => (
          <g key={j.jour}>
            <rect
              x={x(i) - largeurBarre / 2}
              y={yNotants(j.notants)}
              width={largeurBarre}
              height={HAUTEUR_UTILE - (yNotants(j.notants) - MARGE.haut)}
              rx={2}
              className={survol === null || survol === i ? 'fill-navy-700' : 'fill-navy-200'}
            />
            {i % intervalleEtiquettes === 0 && (
              <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-slate-400 text-[11px]">
                {formatJour(j.jour)}
              </text>
            )}
          </g>
        ))}

        <path d={courbe} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="stroke-gold-500" />
        {jours.map((j, i) =>
          survol === i || (survol === null && i === jours.length - 1) ? (
            <circle key={j.jour} cx={x(i)} cy={yTaux(j.taux)} r={4.5} className="fill-white stroke-gold-600" strokeWidth={2.5} />
          ) : null
        )}

        {/* Zones de survol, une par jour, sur toute la hauteur */}
        {jours.map((j, i) => (
          <rect
            key={j.jour}
            x={MARGE.gauche + pas * i}
            y={MARGE.haut}
            width={pas}
            height={HAUTEUR_UTILE}
            fill="transparent"
            onPointerEnter={() => setSurvol(i)}
            onPointerDown={() => setSurvol(i)}
          />
        ))}
      </svg>
      <p className="mt-1 text-xs text-slate-400">
        {notantsAttendus} notant{notantsAttendus > 1 ? 's' : ''} attendu{notantsAttendus > 1 ? 's' : ''} sur la campagne.
        Survolez le graphique pour le détail d’un jour.
      </p>
    </section>
  )
}
