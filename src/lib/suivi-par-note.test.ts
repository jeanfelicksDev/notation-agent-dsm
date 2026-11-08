import { describe, expect, it } from 'vitest'
import { etatAffectation, filtrerSuivi, statutEvaluateur, suiviParNote, trierSuivi } from '@/lib/suivi-par-note'

const aff = (evaluateurId: string, evalueId: string, statut = 'EN_ATTENTE', invalidee = false) => ({
  evaluateurId,
  evalueId,
  statut,
  invalidee,
})

const AFFECTATIONS = [
  aff('m1', 'awa', 'TERMINEE'),
  aff('p1', 'awa', 'BROUILLON'),
  aff('p2', 'awa'),
  aff('c1', 'awa'), // cadre : vote facultatif
  aff('m1', 'koffi', 'TERMINEE'),
  aff('p1', 'koffi', 'TERMINEE'),
  aff('p3', 'koffi', 'TERMINEE', true),
]
const estFacultatif = (id: string) => id === 'c1'

describe('etatAffectation', () => {
  it('fait primer l’invalidation sur le statut', () => {
    expect(etatAffectation(aff('a', 'b', 'TERMINEE', true))).toBe('INVALIDEE')
    expect(etatAffectation(aff('a', 'b', 'BROUILLON'))).toBe('BROUILLON')
  })

  it('traite un statut inconnu comme non commencé', () => {
    expect(etatAffectation(aff('a', 'b', 'AUTRE'))).toBe('EN_ATTENTE')
  })
})

describe('suiviParNote', () => {
  const suivis = suiviParNote(AFFECTATIONS, estFacultatif)
  const awa = suivis.find((s) => s.evalueId === 'awa')!

  it('regroupe les notants de chaque noté', () => {
    expect(suivis.map((s) => s.evalueId).sort()).toEqual(['awa', 'koffi'])
    expect(awa.notants.map((n) => n.evaluateurId)).toEqual(['m1', 'p1', 'p2', 'c1'])
  })

  it('compte les notants par état', () => {
    expect(awa.compte).toEqual({ EN_ATTENTE: 2, BROUILLON: 1, TERMINEE: 1, INVALIDEE: 0 })
  })

  it('ne compte pas un cadre facultatif parmi les notants attendus', () => {
    expect(awa.notants.find((n) => n.evaluateurId === 'c1')?.facultatif).toBe(true)
    expect(awa.restants).toBe(2) // p1 (en cours) et p2 (non commencé)
  })

  it('ne compte pas un notant invalidé parmi les restants', () => {
    expect(suivis.find((s) => s.evalueId === 'koffi')!.restants).toBe(0)
  })

  it('montre en cours chez tous ses notés un notant qui a commencé son évaluation', () => {
    const etats = suiviParNote([aff('p4', 'awa', 'BROUILLON'), aff('p4', 'koffi'), aff('p5', 'koffi')])
    const koffi = etats.find((s) => s.evalueId === 'koffi')!
    expect(koffi.notants.map((n) => [n.evaluateurId, n.etat])).toEqual([
      ['p4', 'BROUILLON'],
      ['p5', 'EN_ATTENTE'],
    ])
    expect(koffi.restants).toBe(2)
  })

  it('montre en cours un nouveau noté confié à un notant qui avait déjà soumis', () => {
    const etats = suiviParNote([aff('p4', 'awa', 'TERMINEE'), aff('p4', 'koffi')])
    expect(etats.find((s) => s.evalueId === 'koffi')!.notants[0].etat).toBe('BROUILLON')
  })

  it('ne tient pas compte d’une affectation invalidée pour dire qu’un notant a commencé', () => {
    const etats = suiviParNote([aff('p4', 'awa', 'BROUILLON', true), aff('p4', 'koffi')])
    expect(etats.find((s) => s.evalueId === 'koffi')!.notants[0].etat).toBe('EN_ATTENTE')
  })
})

describe('filtrerSuivi', () => {
  const suivis = suiviParNote(AFFECTATIONS, estFacultatif)

  it('garde tout avec le filtre TOUS', () => {
    expect(filtrerSuivi(suivis, 'TOUS')).toEqual(suivis)
  })

  it('ne garde que les notés concernés et, pour chacun, les notants dans l’état choisi', () => {
    const attente = filtrerSuivi(suivis, 'EN_ATTENTE')
    expect(attente.map((s) => s.evalueId)).toEqual(['awa'])
    expect(attente[0].notants.map((n) => n.evaluateurId)).toEqual(['p2', 'c1'])
  })

  it('ne modifie pas la liste d’origine', () => {
    filtrerSuivi(suivis, 'TERMINEE')
    expect(suivis.find((s) => s.evalueId === 'awa')!.notants).toHaveLength(4)
  })
})

describe('trierSuivi', () => {
  const suivis = suiviParNote(AFFECTATIONS, estFacultatif)
  const noms: Record<string, string> = { awa: 'Zadi Awa', koffi: 'Achi Koffi' }
  const nomDe = (id: string) => noms[id]

  it('trie par nom', () => {
    expect(trierSuivi(suivis, 'NOM', nomDe).map((s) => s.evalueId)).toEqual(['koffi', 'awa'])
  })

  it('met en tête les notés qui attendent le plus de notes', () => {
    expect(trierSuivi(suivis, 'RESTANTS', nomDe).map((s) => s.evalueId)).toEqual(['awa', 'koffi'])
  })
})

describe('statutEvaluateur', () => {
  const de = (...statuts: string[]) => statuts.map((statut, i) => aff('n', `e${i}`, statut))

  it("n'est terminé que si toutes ses évaluations sont soumises", () => {
    expect(statutEvaluateur(de('TERMINEE', 'TERMINEE'))).toBe('TERMINEE')
  })

  it('est en cours si une évaluation reste ouverte après une soumission (affectation ajoutée ensuite)', () => {
    expect(statutEvaluateur(de('TERMINEE', 'TERMINEE', 'EN_ATTENTE'))).toBe('BROUILLON')
  })

  it('est en cours avec un brouillon, non commencé sinon', () => {
    expect(statutEvaluateur(de('BROUILLON', 'EN_ATTENTE'))).toBe('BROUILLON')
    expect(statutEvaluateur(de('EN_ATTENTE', 'EN_ATTENTE'))).toBe('EN_ATTENTE')
  })

  it("est invalidé dès qu'une de ses évaluations l'est (l'invalidation porte sur le notant)", () => {
    expect(statutEvaluateur([aff('n', 'a', 'TERMINEE'), aff('n', 'b', 'EN_ATTENTE', true)])).toBe('INVALIDEE')
  })

  it('est non commencé sans aucune affectation', () => {
    expect(statutEvaluateur([])).toBe('EN_ATTENTE')
  })
})
