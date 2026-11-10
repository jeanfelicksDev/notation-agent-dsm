/**
 * Son du décompte de la page des résultats : un bip à chaque chiffre,
 * puis une note plus haute et plus longue au zéro. Le son est synthétisé
 * par le navigateur (Web Audio), sans fichier audio.
 */

export interface Note {
  frequenceHz: number
  dureeMs: number
}

const BIP: Note = { frequenceHz: 440, dureeMs: 160 }
const NOTE_FINALE: Note = { frequenceHz: 880, dureeMs: 750 }

/** Volume de crête, volontairement modéré : la salle règle le niveau sur sa sonorisation. */
const VOLUME = 0.3
const ATTAQUE_S = 0.01
/** Le gain ne peut pas descendre à 0 sur une rampe exponentielle. */
const SILENCE = 0.0001

/** Note jouée quand le décompte affiche ce chiffre. */
export function noteDuDecompte(valeur: number): Note {
  return valeur > 0 ? BIP : NOTE_FINALE
}

/** Joue une note avec une attaque franche et une extinction douce, sans claquement. */
export function jouerNote(contexte: AudioContext, note: Note): void {
  const debut = contexte.currentTime
  const fin = debut + note.dureeMs / 1000

  const oscillateur = contexte.createOscillator()
  oscillateur.type = 'triangle'
  oscillateur.frequency.setValueAtTime(note.frequenceHz, debut)

  const gain = contexte.createGain()
  gain.gain.setValueAtTime(SILENCE, debut)
  gain.gain.exponentialRampToValueAtTime(VOLUME, debut + ATTAQUE_S)
  gain.gain.exponentialRampToValueAtTime(SILENCE, fin)

  oscillateur.connect(gain).connect(contexte.destination)
  oscillateur.start(debut)
  oscillateur.stop(fin)
}
