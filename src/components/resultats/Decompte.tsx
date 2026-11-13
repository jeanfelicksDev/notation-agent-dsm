import { DEBUT_DECOMPTE } from '@/lib/revelation'

type Props = {
  /** Chiffre affiché, de 5 à 0. */
  valeur: number
  /** Le navigateur attend un clic ou une touche avant d'autoriser le son. */
  sonEnAttente: boolean
}

/** Chiffres du décompte, du premier au dernier : 5, 4, 3, 2, 1, 0. */
const ETAPES = Array.from({ length: DEBUT_DECOMPTE + 1 }, (_, i) => DEBUT_DECOMPTE - i)

/** Écran plein cadre du décompte qui ouvre la révélation. */
export function Decompte({ valeur, sonEnAttente }: Props) {
  return (
    <div
      role="timer"
      aria-label={`Révélation dans ${valeur}`}
      className="animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-navy-950/95 backdrop-blur-md"
    >
      <p className="text-sm font-semibold tracking-[0.3em] text-gold-300 uppercase">Et voici les lauréats…</p>
      {/* La clé relance l'animation à chaque seconde. */}
      <span
        key={valeur}
        data-numeric
        aria-hidden
        className="animate-decompte font-display text-[clamp(9rem,34vw,24rem)] leading-none font-semibold text-gold-400 drop-shadow-[0_0_60px_rgb(212_175_55/0.45)]"
      >
        {valeur}
      </span>
      <ol aria-hidden className="flex gap-2">
        {ETAPES.map((etape) => (
          <li
            key={etape}
            className={`h-1.5 w-10 rounded-full transition-colors duration-300 ${etape >= valeur ? 'bg-gold-400' : 'bg-white/15'}`}
          />
        ))}
      </ol>
      {sonEnAttente && (
        <p className="animate-fade-in absolute bottom-8 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-navy-100 ring-1 ring-white/15">
          Cliquez ou appuyez sur une touche pour activer le son
        </p>
      )}
    </div>
  )
}
