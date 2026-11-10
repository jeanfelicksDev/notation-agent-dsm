import type { Options } from 'canvas-confetti'

/** Or de la charte, blanc et bleu clair : les confettis restent dans les couleurs de la page. */
const COULEURS = ['#d4af37', '#e5c965', '#f6ecc8', '#ffffff', '#9fb4c9']

/** Durée pendant laquelle les deux canons latéraux tirent après l'explosion centrale. */
const DUREE_CANONS_MS = 4500
const INTERVALLE_TIRS_MS = 220

const COMMUN: Options = { colors: COULEURS, disableForReducedMotion: true, zIndex: 60 }

const EXPLOSION: Options = { ...COMMUN, particleCount: 220, spread: 110, startVelocity: 55, origin: { x: 0.5, y: 0.45 } }
const CANON_GAUCHE: Options = { ...COMMUN, particleCount: 9, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } }
const CANON_DROIT: Options = { ...COMMUN, particleCount: 9, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } }

/**
 * Explosion de confettis pour le Captain, comme à la sortie d'un mariage :
 * une gerbe au centre, puis deux canons qui tirent depuis les côtés.
 * Renvoie la fonction qui arrête et efface les confettis.
 */
export function celebrer(): () => void {
  let estAnnule = false
  let tirs: ReturnType<typeof setInterval> | undefined
  let effacer: (() => void) | undefined

  // La bibliothèque n'est chargée qu'au moment de la célébration.
  import('canvas-confetti')
    .then(({ default: confetti }) => {
      if (estAnnule) return
      effacer = () => confetti.reset()
      void confetti(EXPLOSION)

      const fin = Date.now() + DUREE_CANONS_MS
      tirs = setInterval(() => {
        if (Date.now() > fin) {
          clearInterval(tirs)
          return
        }
        void confetti(CANON_GAUCHE)
        void confetti(CANON_DROIT)
      }, INTERVALLE_TIRS_MS)
    })
    .catch(() => {
      // Confettis indisponibles (chargement refusé) : décor seulement, la révélation reste complète.
    })

  return () => {
    estAnnule = true
    clearInterval(tirs)
    effacer?.()
  }
}
