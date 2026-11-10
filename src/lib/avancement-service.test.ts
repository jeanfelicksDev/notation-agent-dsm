import { describe, expect, it } from 'vitest'
import { aDesNonSoumises, avancementParService, cleServiceSuivi } from '@/lib/avancement-service'

const ev = (service: string | null, totalToEvaluate: number, soumises: number, role = 'UTILISATEUR') => ({
  user: { role, service },
  totalToEvaluate,
  soumises,
})

describe('cleServiceSuivi', () => {
  it('écarte les clients externes et regroupe les agents sans service', () => {
    expect(cleServiceSuivi({ role: 'EXTERNE', service: null })).toBeNull()
    expect(cleServiceSuivi({ role: 'UTILISATEUR', service: '  ' })).toBe('Sans service')
    expect(cleServiceSuivi({ role: 'MANAGER', service: ' Magasin ' })).toBe('Magasin')
  })
})

describe('aDesNonSoumises', () => {
  it("repère l'évaluateur à qui il reste au moins une évaluation", () => {
    expect(aDesNonSoumises({ totalToEvaluate: 3, soumises: 2 })).toBe(true)
    expect(aDesNonSoumises({ totalToEvaluate: 3, soumises: 3 })).toBe(false)
  })
})

describe('avancementParService', () => {
  it('compte les évaluations des notants internes, cadres compris, comme la modale de l’accueil', () => {
    // Compte d'escale : 28 évaluations soumises sur 30, dont 2 en attente chez un cadre
    const resultat = avancementParService([
      ev("Compte d'escale", 4, 4, 'CADRE'),
      ev("Compte d'escale", 5, 5, 'MANAGER'),
      ev("Compte d'escale", 3, 3),
      ev("Compte d'escale", 6, 6),
      ev("Compte d'escale", 5, 5),
      ev("Compte d'escale", 5, 5),
      ev("Compte d'escale", 2, 0, 'CADRE'),
      ev('Magasin', 4, 4),
      ev(null, 2, 1),
      ev(null, 3, 0, 'EXTERNE'),
    ])
    expect(resultat).toEqual([
      { service: 'Magasin', total: 4, soumises: 4, restantes: 0, taux: 100 },
      { service: "Compte d'escale", total: 30, soumises: 28, restantes: 2, taux: 93 },
      { service: 'Sans service', total: 2, soumises: 1, restantes: 1, taux: 50 },
    ])
  })

  it('renvoie une liste vide sans évaluateur interne', () => {
    expect(avancementParService([ev(null, 2, 2, 'EXTERNE')])).toEqual([])
  })
})
