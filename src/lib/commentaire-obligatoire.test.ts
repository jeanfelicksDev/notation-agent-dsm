import { describe, expect, it } from 'vitest'
import { commentaireObligatoire, noteJustifiee, SEUIL_COMMENTAIRE_OBLIGATOIRE } from '@/lib/commentaire-obligatoire'

describe('commentaireObligatoire', () => {
  it('exige un commentaire pour toute note inférieure ou égale à 2', () => {
    expect(SEUIL_COMMENTAIRE_OBLIGATOIRE).toBe(2)
    expect(commentaireObligatoire(1)).toBe(true)
    expect(commentaireObligatoire(2)).toBe(true)
  })

  it('laisse le commentaire facultatif au-delà de 2', () => {
    expect(commentaireObligatoire(3)).toBe(false)
    expect(commentaireObligatoire(10)).toBe(false)
  })

  it("n'exige rien tant que le critère n'est pas noté (0)", () => {
    expect(commentaireObligatoire(0)).toBe(false)
  })
})

describe('noteJustifiee', () => {
  it('refuse une note basse sans commentaire, vide ou fait d’espaces', () => {
    expect(noteJustifiee(2, null)).toBe(false)
    expect(noteJustifiee(1, undefined)).toBe(false)
    expect(noteJustifiee(2, '')).toBe(false)
    expect(noteJustifiee(1, '   \n ')).toBe(false)
  })

  it('accepte une note basse commentée', () => {
    expect(noteJustifiee(1, 'Retards répétés sur les dossiers')).toBe(true)
  })

  it('accepte une note au-dessus du seuil sans commentaire', () => {
    expect(noteJustifiee(3, null)).toBe(true)
    expect(noteJustifiee(5, '')).toBe(true)
  })
})
