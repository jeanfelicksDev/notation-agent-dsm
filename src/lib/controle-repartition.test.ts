import { describe, expect, it } from 'vitest'
import { controlerRepartition, type AgentControle } from '@/lib/controle-repartition'

const agent = (id: string, role = 'UTILISATEUR'): AgentControle => ({ id, nom: id, prenom: '', matricule: id, role })

const agents = [agent('M', 'MANAGER'), agent('K', 'CADRE'), agent('A'), agent('B'), agent('C'), agent('D')]

describe('controlerRepartition — seuil de notants', () => {
  const affectations = [
    // A : manager + 2 pairs → 3 notants affectés
    { evaluateurId: 'M', evalueId: 'A' },
    { evaluateurId: 'B', evalueId: 'A' },
    { evaluateurId: 'C', evalueId: 'A' },
    // B : manager + 1 pair + 1 cadre facultatif + 1 pair invalidé → 2 notants sur lesquels compter
    { evaluateurId: 'M', evalueId: 'B' },
    { evaluateurId: 'A', evalueId: 'B' },
    { evaluateurId: 'K', evalueId: 'B' },
    { evaluateurId: 'C', evalueId: 'B', invalidee: true },
    // C : un seul notant ; D : aucun (déjà signalé « sans notant »)
    { evaluateurId: 'M', evalueId: 'C' },
  ]

  it('signale les Pairs qui ont moins de notants affectés que le seuil, cadres et invalidés exclus', () => {
    const controle = controlerRepartition(agents, affectations, 3)
    expect(controle.sousLeSeuil.map((a) => a.id)).toEqual(['B', 'C'])
    expect(controle.sansNotant.map((a) => a.id)).toEqual(['D'])
  })

  it("compte un cadre qui a déjà soumis son évaluation", () => {
    const avecCadreSoumis = affectations.map((a) => (a.evaluateurId === 'K' ? { ...a, statut: 'TERMINEE' } : a))
    expect(controlerRepartition(agents, avecCadreSoumis, 3).sousLeSeuil.map((a) => a.id)).toEqual(['C'])
  })

  it("ne signale rien en règle historique (seuil null)", () => {
    expect(controlerRepartition(agents, affectations, null).sousLeSeuil).toEqual([])
  })
})
