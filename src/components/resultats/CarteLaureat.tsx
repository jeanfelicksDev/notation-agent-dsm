import type { Laureat } from '@/lib/palmares-ceremonie'
import { DELAI_ENTRE_CARTES_MS, DUREE_APPARITION_CARTE_MS } from '@/lib/revelation'

export type TailleCarte = 'grande' | 'moyenne' | 'compacte'

type Styles = { carte: string; revelee: string; entite: string; nom: string; score: string; mystere: string }

const STYLES: Record<TailleCarte, Styles> = {
  grande: {
    carte: 'gap-3 rounded-3xl px-8 py-8 sm:px-14 sm:py-10',
    revelee: 'bg-gold-500 text-navy-950 shadow-[0_0_90px_-10px_rgb(212_175_55/0.65)] ring-1 ring-gold-200',
    entite: 'text-xs tracking-[0.28em] uppercase',
    nom: 'font-display text-4xl font-semibold sm:text-6xl',
    score: 'text-2xl sm:text-3xl',
    mystere: 'text-7xl sm:text-8xl',
  },
  moyenne: {
    carte: 'gap-2 rounded-2xl px-5 py-6',
    revelee: 'bg-navy-800 text-white ring-1 ring-gold-500/60 shadow-raised',
    entite: 'text-2xs tracking-[0.2em] uppercase',
    nom: 'font-display text-xl font-semibold sm:text-2xl',
    score: 'text-lg',
    mystere: 'text-5xl',
  },
  compacte: {
    carte: 'gap-1.5 rounded-xl px-2.5 py-4',
    revelee: 'bg-white/[0.07] text-white ring-1 ring-white/20',
    // Douze cartes sur une ligne : casse normale et sans interlettrage, pour ne pas couper les noms de service.
    entite: 'text-2xs leading-tight',
    nom: 'text-xs font-semibold sm:text-sm',
    score: 'text-sm',
    mystere: 'text-3xl',
  },
}

type Props = {
  laureat: Laureat
  estRevele: boolean
  taille: TailleCarte
  /** Position dans le niveau, pour l'entrée en cascade. */
  rang: number
}

/** Carte d'un lauréat : l'entité est toujours visible, le nom n'apparaît qu'à la révélation. */
export function CarteLaureat({ laureat, estRevele, taille, rang }: Props) {
  const styles = STYLES[taille]
  const base = `flex h-full min-w-0 flex-col items-center justify-center text-center ${styles.carte}`
  const entite = `font-semibold [overflow-wrap:anywhere] ${styles.entite}`

  if (!estRevele) {
    return (
      <article className={`${base} border border-dashed border-gold-500/35 bg-white/[0.03]`}>
        <p className={`${entite} text-navy-200`}>{laureat.entite}</p>
        <p aria-hidden className={`font-display leading-none text-gold-500/45 ${styles.mystere}`}>
          ?
        </p>
        <span className="sr-only">Lauréat pas encore révélé</span>
      </article>
    )
  }

  const estCaptain = taille === 'grande'
  return (
    <article
      className={`${base} animate-revelation ${styles.revelee}`}
      // Rythme partagé avec la séquence, qui attend la fin de la cascade avant le niveau suivant.
      style={{
        animationDelay: `${rang * DELAI_ENTRE_CARTES_MS}ms`,
        animationDuration: `${DUREE_APPARITION_CARTE_MS}ms`,
      }}
    >
      <p className={`${entite} ${estCaptain ? 'text-navy-800' : 'text-gold-300'}`}>{laureat.entite}</p>
      <h3 className={`leading-tight [overflow-wrap:anywhere] ${styles.nom}`}>{laureat.nomComplet}</h3>
      {taille !== 'compacte' && (
        <p className={`text-xs ${estCaptain ? 'text-navy-800' : 'text-navy-200'}`}>{laureat.precision}</p>
      )}
      <p data-numeric className={`font-semibold ${styles.score} ${estCaptain ? 'text-navy-950' : 'text-gold-300'}`}>
        {laureat.scoreTotal.toFixed(1)} %
      </p>
    </article>
  )
}
