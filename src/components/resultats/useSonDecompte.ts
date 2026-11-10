import { useCallback, useEffect, useRef } from 'react'
import { jouerNote, noteDuDecompte } from '@/lib/son-decompte'

/**
 * Son du décompte : une note à chaque chiffre affiché.
 * Le navigateur n'autorise le son qu'après un geste de l'utilisateur : `preparer` doit être
 * appelé dans le gestionnaire du clic ou de la touche qui lance le décompte.
 */
export function useSonDecompte(decompte: number | null, estActif: boolean): { preparer: () => void } {
  const contexteRef = useRef<AudioContext | null>(null)

  const dernierChiffreRef = useRef<number | null>(null)

  const preparer = useCallback(() => {
    // Navigateur sans Web Audio : le décompte reste visuel.
    if (typeof AudioContext === 'undefined') return
    try {
      contexteRef.current ??= new AudioContext()
    } catch {
      // Création refusée (limite du navigateur) : le décompte reste visuel, la révélation n'est pas bloquée.
      return
    }
    if (contexteRef.current.state === 'suspended') {
      contexteRef.current.resume().catch(() => {
        // Reprise refusée par le navigateur : le décompte reste visuel.
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
