'use client'

import { useEffect, type CSSProperties } from 'react'
import { Check } from 'lucide-react'

/** Au-delà, la barre de segments deviendrait illisible : on garde le seul compteur. */
const MAX_SEGMENTS = 24

export interface TransitionCollaborateurProps {
  /** Collaborateur que l'on quitte (absent au premier affichage). */
  de: { nom: string; complet: boolean } | null
  vers: { nom: string; initiales: string; service: string | null }
  /** Position 1-based du collaborateur affiché. */
  position: number
  /** État « terminé » de chaque collaborateur, dans l'ordre du parcours. */
  termines: boolean[]
  /** 1 = collaborateur suivant, -1 = précédent : fixe le sens du rideau. */
  sens: 1 | -1
  onFin: () => void
}

/**
 * Rideau navy qui traverse la zone de notation au changement de collaborateur.
 * Le nouveau collaborateur est déjà chargé dessous : un clic ou Échap écourte l'animation.
 */
export function TransitionCollaborateur({ de, vers, position, termines, sens, onFin }: TransitionCollaborateurProps) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFin()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFin])

  const total = termines.length
  const suivant = sens === 1

  return (
    <div
      className="absolute inset-0 z-30 cursor-pointer overflow-hidden"
      style={{ '--sens': sens } as CSSProperties}
      onClick={onFin}
    >
      <p className="sr-only" role="status">
        Vous notez maintenant {vers.nom}, collaborateur {position} sur {total}.
      </p>
      <div
        aria-hidden
        className="absolute inset-0 flex animate-rideau items-center justify-center bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-navy-800)_0%,var(--color-navy-950)_70%)] px-6 text-white"
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) onFin()
        }}
      >
        {/* Bords dorés : celui d'attaque à l'entrée, celui de fuite à la sortie */}
        <span className="absolute inset-y-0 left-0 w-[3px] bg-gold-400" />
        <span className="absolute inset-y-0 right-0 w-[3px] bg-gold-400" />

        <div className="flex w-full max-w-md flex-col items-center text-center">
          <p className="text-2xs font-semibold tracking-[0.22em] text-gold-300 uppercase">
            {suivant ? 'Collaborateur suivant' : 'Collaborateur précédent'}
          </p>

          {de && (
            <p className="mt-4 flex h-6 animate-rideau-sortie items-center gap-2 text-sm text-navy-200">
              {de.complet && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-400/20 text-gold-300">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span className="max-w-[18rem] truncate">{de.nom}</span>
              {de.complet && <span className="text-navy-300">· noté</span>}
            </p>
          )}

          <span className="mt-2 flex h-20 w-20 animate-rideau-medaillon items-center justify-center rounded-full bg-gradient-to-b from-navy-700 to-navy-900 font-display text-2xl font-medium ring-2 ring-gold-400 ring-offset-4 ring-offset-navy-900">
            {vers.initiales}
          </span>

          <h2 className="mt-5 max-w-full animate-rideau-arrivee truncate font-display text-[2rem] leading-tight font-medium tracking-[-0.01em]">
            {vers.nom}
          </h2>
          <p className="mt-1 animate-rideau-arrivee text-sm text-navy-200">{vers.service || 'Service non renseigné'}</p>

          <span className="mt-5 block h-px w-24 origin-center animate-rideau-trait bg-gold-400" />

          {total <= MAX_SEGMENTS && (
            <div className="mt-5 flex flex-wrap justify-center gap-1">
              {termines.map((fini, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-5 rounded-full ${
                    i === position - 1 ? 'bg-gold-400' : fini ? 'bg-gold-500/45' : 'bg-white/15'
                  }`}
                />
              ))}
            </div>
          )}
          <p className="mt-2.5 text-xs text-navy-200 tabular-nums">
            Collaborateur <span className="font-semibold text-white">{position}</span> sur {total}
          </p>

          <p className="mt-8 text-2xs text-navy-300">Cliquez ou appuyez sur Échap pour passer</p>
        </div>
      </div>
    </div>
  )
}
