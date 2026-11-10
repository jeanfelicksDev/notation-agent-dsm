/**
 * Sons de la page des résultats, synthétisés par le navigateur (Web Audio), sans fichier audio :
 * - le décompte : un bip à chaque chiffre, puis une note plus haute et plus longue au zéro ;
 * - la fanfare du gagnant, jouée quand le Captain apparaît.
 */

export interface Note {
  frequenceHz: number
  dureeMs: number
}

/** Note d'une mélodie, placée par rapport au début de celle-ci. */
export interface NotePlanifiee extends Note {
  debutMs: number
}

const BIP: Note = { frequenceHz: 440, dureeMs: 160 }
const NOTE_FINALE: Note = { frequenceHz: 880, dureeMs: 750 }

const SOL4 = 392.0
const DO5 = 523.25
const MI5 = 659.25
const SOL5 = 783.99
const DO6 = 1046.5

const DEBUT_ACCORD_MS = 1190
const DUREE_ACCORD_MS = 1800

/** Fanfare en do majeur : une montée de quatre notes, une reprise, puis l'accord final tenu. */
export const FANFARE_DU_GAGNANT: readonly NotePlanifiee[] = [
  { frequenceHz: SOL4, debutMs: 0, dureeMs: 160 },
  { frequenceHz: DO5, debutMs: 170, dureeMs: 160 },
  { frequenceHz: MI5, debutMs: 340, dureeMs: 160 },
  { frequenceHz: SOL5, debutMs: 510, dureeMs: 480 },
  { frequenceHz: MI5, debutMs: 1020, dureeMs: 160 },
  ...[DO5, MI5, SOL5, DO6].map((frequenceHz) => ({ frequenceHz, debutMs: DEBUT_ACCORD_MS, dureeMs: DUREE_ACCORD_MS })),
]

export function dureeFanfareMs(): number {
  return Math.max(...FANFARE_DU_GAGNANT.map((note) => note.debutMs + note.dureeMs))
}

/** Volume de crête, volontairement modéré : la salle règle le niveau sur sa sonorisation. */
const VOLUME = 0.3
const ATTAQUE_S = 0.01
/** Le gain ne peut pas descendre à 0 sur une rampe exponentielle. */
const SILENCE = 0.0001

/** Note jouée quand le décompte affiche ce chiffre. */
export function noteDuDecompte(valeur: number): Note {
  return valeur > 0 ? BIP : NOTE_FINALE
}

interface OptionsDeJeu {
  /** Retard avant le début de la note. */
  decalageMs?: number
  /** Volume de crête ; à réduire pour les notes jouées ensemble. */
  volume?: number
}

/** Joue une note avec une attaque franche et une extinction douce, sans claquement. */
export function jouerNote(contexte: AudioContext, note: Note, options: OptionsDeJeu = {}): void {
  const { decalageMs = 0, volume = VOLUME } = options
  const debut = contexte.currentTime + decalageMs / 1000
  const fin = debut + note.dureeMs / 1000

  const oscillateur = contexte.createOscillator()
  oscillateur.type = 'triangle'
  oscillateur.frequency.setValueAtTime(note.frequenceHz, debut)

  const gain = contexte.createGain()
  gain.gain.setValueAtTime(SILENCE, debut)
  gain.gain.exponentialRampToValueAtTime(volume, debut + ATTAQUE_S)
  gain.gain.exponentialRampToValueAtTime(SILENCE, fin)

  oscillateur.connect(gain).connect(contexte.destination)
  oscillateur.start(debut)
  oscillateur.stop(fin)
}

/** Joue la fanfare du gagnant ; les notes d'un accord se partagent le volume pour ne pas saturer. */
export function jouerFanfare(contexte: AudioContext): void {
  for (const note of FANFARE_DU_GAGNANT) {
    const simultanees = FANFARE_DU_GAGNANT.filter((autre) => autre.debutMs === note.debutMs).length
    jouerNote(contexte, note, { decalageMs: note.debutMs, volume: VOLUME / Math.sqrt(simultanees) })
  }
}
