import { useCallback, useEffect, useRef, useState } from 'react'
import { jouerFanfare, jouerNote, noteDuDecompte } from '@/lib/son-decompte'

type Parametres = {
  /** Chiffre affiché par le décompte, ou null hors décompte. */
  decompte: number | null
  captainRevele: boolean
}

type SonCeremonie = {
  /** Le navigateur attend un geste (clic ou touche) avant d'autoriser le son. */
  estBloque: boolean
}

/** Un son autorisé démarre en quelques millisecondes : passé ce délai, on le considère bloqué. */
const DELAI_CONSTAT_BLOCAGE_MS = 600

/**
 * Joue tout de suite si le son est ouvert. S'il ne s'ouvre que plus tard (premier geste de
 * l'utilisateur), ne joue que ce qui est encore d'actualité, pour ne pas rattraper les sons passés.
 */
function jouerDesQuePossible(contexte: AudioContext, estEncoreActuel: () => boolean, jouer: () => void): void {
  if (contexte.state === 'running') {
    jouer()
    return
  }
  contexte
    .resume()
    .then(() => {
      if (estEncoreActuel()) jouer()
    })
    .catch(() => {
      // Contexte fermé entre-temps (page quittée) : plus rien à jouer.
    })
}

/**
 * Sons de la révélation : une note à chaque chiffre du décompte, puis la fanfare du gagnant
 * quand le Captain apparaît.
 * La page démarre seule, or le navigateur peut exiger un geste avant d'autoriser le son :
 * le son est tenté dès l'ouverture, puis rouvert au premier clic ou à la première touche.
 */
export function useSonCeremonie({ decompte, captainRevele }: Parametres): SonCeremonie {
  const contexteRef = useRef<AudioContext | null>(null)
  const dernierChiffreRef = useRef<number | null>(null)
  const fanfareJoueeRef = useRef(false)
  const [estBloque, setEstBloque] = useState(false)

  const preparer = useCallback(() => {
    // Navigateur sans Web Audio : la révélation reste visuelle.
    if (typeof AudioContext === 'undefined') return
    if (!contexteRef.current) {
      try {
        const contexte = new AudioContext()
        contexte.addEventListener('statechange', () => setEstBloque(contexte.state === 'suspended'))
        contexteRef.current = contexte
      } catch {
        // Création refusée (limite du navigateur) : la révélation reste visuelle et n'est pas bloquée.
        return
      }
    }
    if (contexteRef.current.state === 'suspended') {
      contexteRef.current.resume().catch(() => {
        // Reprise refusée par le navigateur : la révélation reste visuelle.
      })
    }
  }, [])

  // Déclaré avant les effets qui jouent : le son est ouvert quand le premier chiffre s'affiche.
  useEffect(() => {
    preparer()
    const constat = setTimeout(() => setEstBloque(contexteRef.current?.state === 'suspended'), DELAI_CONSTAT_BLOCAGE_MS)
    window.addEventListener('pointerdown', preparer)
    window.addEventListener('keydown', preparer)

    return () => {
      clearTimeout(constat)
      window.removeEventListener('pointerdown', preparer)
      window.removeEventListener('keydown', preparer)
      contexteRef.current?.close().catch(() => {
        // Contexte déjà fermé : rien à libérer.
      })
      contexteRef.current = null
      dernierChiffreRef.current = null
      fanfareJoueeRef.current = false
    }
  }, [preparer])

  useEffect(() => {
    // Chaque chiffre ne sonne qu'une fois.
    if (decompte === dernierChiffreRef.current) return
    dernierChiffreRef.current = decompte
    const contexte = contexteRef.current
    if (decompte === null || !contexte) return
    jouerDesQuePossible(
      contexte,
      () => dernierChiffreRef.current === decompte,
      () => jouerNote(contexte, noteDuDecompte(decompte))
    )
  }, [decompte])

  useEffect(() => {
    // La fanfare ne part qu'une fois par révélation.
    if (captainRevele === fanfareJoueeRef.current) return
    fanfareJoueeRef.current = captainRevele
    const contexte = contexteRef.current
    if (!captainRevele || !contexte) return
    jouerDesQuePossible(
      contexte,
      () => fanfareJoueeRef.current,
      () => jouerFanfare(contexte)
    )
  }, [captainRevele])

  return { estBloque }
}
