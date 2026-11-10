import { useCallback, useEffect, useRef } from 'react'
import { jouerFanfare, jouerNote, noteDuDecompte } from '@/lib/son-decompte'

type Parametres = {
  /** Chiffre affiché par le décompte, ou null hors décompte. */
  decompte: number | null
  captainRevele: boolean
  estActif: boolean
}

/**
 * Sons de la révélation : une note à chaque chiffre du décompte, puis la fanfare du gagnant
 * quand le Captain apparaît.
 * Le navigateur n'autorise le son qu'après un geste de l'utilisateur : `preparer` doit être
 * appelé dans le gestionnaire du clic ou de la touche qui lance la révélation.
 */
export function useSonCeremonie({ decompte, captainRevele, estActif }: Parametres): { preparer: () => void } {
  const contexteRef = useRef<AudioContext | null>(null)
  const dernierChiffreRef = useRef<number | null>(null)
  const fanfareJoueeRef = useRef(false)

  const preparer = useCallback(() => {
    // Navigateur sans Web Audio : la révélation reste visuelle.
    if (typeof AudioContext === 'undefined') return
    try {
      contexteRef.current ??= new AudioContext()
    } catch {
      // Création refusée (limite du navigateur) : la révélation reste visuelle et n'est pas bloquée.
      return
    }
    if (contexteRef.current.state === 'suspended') {
      contexteRef.current.resume().catch(() => {
        // Reprise refusée par le navigateur : la révélation reste visuelle.
      })
    }
  }, [])

  useEffect(() => {
    // Chaque chiffre ne sonne qu'une fois, même si le son est coupé puis réactivé pendant qu'il est affiché.
    if (decompte === dernierChiffreRef.current) return
    dernierChiffreRef.current = decompte
    const contexte = contexteRef.current
    if (decompte === null || !estActif || !contexte) return
    jouerNote(contexte, noteDuDecompte(decompte))
  }, [decompte, estActif])

  useEffect(() => {
    // La fanfare ne part qu'une fois par révélation, même si le son est réactivé après coup.
    if (captainRevele === fanfareJoueeRef.current) return
    fanfareJoueeRef.current = captainRevele
    const contexte = contexteRef.current
    if (!captainRevele || !estActif || !contexte) return
    jouerFanfare(contexte)
  }, [captainRevele, estActif])

  useEffect(
    () => () => {
      contexteRef.current?.close().catch(() => {
        // Contexte déjà fermé : rien à libérer.
      })
      contexteRef.current = null
    },
    []
  )

  return { preparer }
}
