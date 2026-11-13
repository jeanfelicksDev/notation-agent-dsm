'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { formaterTempsRestant } from '@/lib/publication-resultats'

/** Fréquence de vérification : assez fine pour basculer sans retard visible à l'heure dite. */
const INTERVALLE_VERIFICATION_MS = 250
/** Si le serveur ne répond pas à l'heure dite, la page lui est redemandée à ce rythme. */
const DELAI_ENTRE_ESSAIS_MS = 5000
/** Pendant l'attente, rythme auquel la page est redemandée pour suivre un changement de date. */
const DELAI_RESYNCHRONISATION_MS = 60_000

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' })

const sansAbonnement = () => () => {}

/** Date dans le fuseau horaire du spectateur : seul le navigateur le connaît, le rendu serveur s'en passe. */
function useDateLocale(dateIso: string): string | null {
  return useSyncExternalStore(
    sansAbonnement,
    () => FORMAT_DATE.format(new Date(dateIso)),
    () => null
  )
}

type ResultatsEnAttenteProps = {
  /** Jour et heure de publication, au format ISO. */
  dateResultats: string
  /** Temps restant mesuré par le serveur au moment du rendu, en millisecondes. */
  delaiMs: number
}

/**
 * Écran affiché tant que le jour et l'heure de publication ne sont pas arrivés.
 * À l'heure dite, la page est redemandée au serveur, qui seul décide d'envoyer les résultats.
 */
export default function ResultatsEnAttente({ dateResultats, delaiMs }: ResultatsEnAttenteProps) {
  const router = useRouter()
  const dateLocale = useDateLocale(dateResultats)
  const [tempsRestant, setTempsRestant] = useState(() => formaterTempsRestant(delaiMs))

  useEffect(() => {
    // L'échéance part du délai donné par le serveur : une horloge mal réglée sur le poste ne la décale pas.
    const echeance = Date.now() + delaiMs
    // Avant l'échéance, la page est redemandée de temps en temps : une date avancée ou effacée est ainsi suivie.
    const prochaineDemande = (maintenant: number) =>
      maintenant < echeance
        ? Math.min(echeance, maintenant + DELAI_RESYNCHRONISATION_MS)
        : maintenant + DELAI_ENTRE_ESSAIS_MS
    let demandeSuivante = prochaineDemande(Date.now())

    const minuterie = setInterval(() => {
      const maintenant = Date.now()
      setTempsRestant(formaterTempsRestant(echeance - maintenant))
      if (maintenant < demandeSuivante) return
      demandeSuivante = prochaineDemande(maintenant)
      router.refresh()
    }, INTERVALLE_VERIFICATION_MS)
    return () => clearInterval(minuterie)
  }, [delaiMs, router])

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <p className="text-sm font-semibold tracking-[0.3em] text-gold-300 uppercase">Résultats à venir</p>
      <div className="max-w-3xl space-y-3">
        <p className="font-display text-2xl font-semibold text-balance sm:text-4xl">
          Les résultats ne sont pas encore disponibles.
        </p>
        {/* Hauteur réservée : la date, connue du navigateur seulement, arrive sans décaler l'écran. */}
        <p className="min-h-7 text-lg text-navy-100 sm:text-xl">
          {dateLocale && (
            <>
              Ils seront dévoilés le{' '}
              <time dateTime={dateResultats} className="font-semibold text-gold-300">
                {dateLocale}
              </time>
              .
            </>
          )}
        </p>
      </div>
      <p
        role="timer"
        aria-label="Temps restant avant les résultats"
        data-numeric
        className="font-display text-[clamp(2.25rem,8vw,5.5rem)] leading-none font-semibold text-gold-400 drop-shadow-[0_0_60px_rgb(212_175_55/0.35)]"
      >
        {tempsRestant}
      </p>
      <p className="max-w-xl text-sm text-navy-200">
        La révélation commencera d’elle-même sur cet écran à l’heure prévue : inutile de recharger la page.
      </p>
    </main>
  )
}
