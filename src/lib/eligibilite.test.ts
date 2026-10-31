import { describe, expect, it } from 'vitest'
import {
  bilansNotants,
  compterSituations,
  estClasse,
  lireSeuilNotants,
  prevoirSituations,
  resumerBilanCloture,
  situationDuNote,
  type AffectationBilan,
  type BilanNotants,
} from '@/lib/eligibilite'

function affectation(evaluateurId: string, evalueId: string, options: Partial<AffectationBilan> = {}): AffectationBilan {
  return {
    evaluateurId,
    evalueId,
    statut: 'TERMINEE',
    invalidee: false,
    clientInterne: false,
    roleEvaluateur: 'UTILISATEUR',
    ...options,
  }
}

function bilan(options: Partial<BilanNotants>): BilanNotants {
  return {
    nbNotants: 0,
    nbAttendus: 0,
    managerSoumis: true,
    managerInvalide: false,
    collegueInvalide: false,
    defaillants: [],
    ...options,
  }
}

describe('situationDuNote', () => {
  it('renvoie null pour une campagne en règle historique (seuil null)', () => {
    expect(situationDuNote(bilan({ managerSoumis: false, nbNotants: 1, nbAttendus: 3 }), null)).toBeNull()
  })

  it('classe SANS_MANAGER un noté sans note du manager, même avec beaucoup de notants', () => {
    expect(situationDuNote(bilan({ managerSoumis: false, nbNotants: 5, nbAttendus: 6 }), 3)).toBe('SANS_MANAGER')
  })

  it('garde classé un noté dont le manager est invalidé pour force majeure', () => {
    const b = bilan({ managerSoumis: false, managerInvalide: true, nbNotants: 3, nbAttendus: 3 })
    expect(situationDuNote(b, 3)).toBe('COMPLET')
  })

  it("ne classe pas un noté dont un manager est invalidé si un autre manager, valide, n'a pas soumis", () => {
    const b = bilan({
      managerSoumis: false,
      managerInvalide: true,
      nbNotants: 3,
      nbAttendus: 4,
      defaillants: [{ evaluateurId: 'M2', manager: true }],
    })
    expect(situationDuNote(b, 3)).toBe('SANS_MANAGER')
  })

  it('est COMPLET quand tous les notants affectés ont soumis, même sous le seuil', () => {
    expect(situationDuNote(bilan({ nbNotants: 2, nbAttendus: 2 }), 3)).toBe('COMPLET')
  })

  it('protège un noté qui atteint le seuil malgré des défaillants', () => {
    expect(situationDuNote(bilan({ nbNotants: 3, nbAttendus: 5 }), 3)).toBe('PROTEGE')
  })

  it('pénalise un noté sous le seuil qui a des défaillants', () => {
    expect(situationDuNote(bilan({ nbNotants: 2, nbAttendus: 3 }), 3)).toBe('PENALISE')
  })
})

describe('bilansNotants', () => {
  it('compte les notants qui ont soumis et les défaillants, sans les notants invalidés', () => {
    const bilans = bilansNotants([
      affectation('M', 'A', { roleEvaluateur: 'MANAGER' }),
      affectation('C1', 'A'),
      affectation('C2', 'A', { statut: 'EN_ATTENTE' }),
      affectation('C3', 'A', { statut: 'EN_ATTENTE', invalidee: true }),
    ])
    expect(bilans.get('A')).toEqual({
      nbNotants: 2,
      nbAttendus: 3,
      managerSoumis: true,
      managerInvalide: false,
      collegueInvalide: true,
      defaillants: [{ evaluateurId: 'C2', manager: false }],
    })
  })

  it('traite un brouillon comme un notant défaillant', () => {
    const bilans = bilansNotants([affectation('M', 'A', { roleEvaluateur: 'MANAGER', statut: 'BROUILLON' })])
    expect(bilans.get('A')).toMatchObject({
      nbNotants: 0,
      managerSoumis: false,
      defaillants: [{ evaluateurId: 'M', manager: true }],
    })
  })

  it('ne compte pas comme manager un manager désigné client interne', () => {
    const bilans = bilansNotants([affectation('M', 'A', { roleEvaluateur: 'MANAGER', clientInterne: true })])
    expect(bilans.get('A')).toMatchObject({ nbNotants: 1, managerSoumis: false })
  })

  it('signale un manager invalidé, qui ne compte ni comme notant ni comme défaillant', () => {
    const bilans = bilansNotants([affectation('M', 'A', { roleEvaluateur: 'MANAGER', statut: 'EN_ATTENTE', invalidee: true })])
    expect(bilans.get('A')).toMatchObject({ nbNotants: 0, nbAttendus: 0, managerInvalide: true, defaillants: [] })
  })

  it("ne compte un cadre (vote facultatif) que s'il a soumis : jamais comme défaillant", () => {
    const bilans = bilansNotants([
      affectation('K1', 'A', { roleEvaluateur: 'CADRE' }),
      affectation('K2', 'A', { roleEvaluateur: 'CADRE', statut: 'EN_ATTENTE' }),
      affectation('K3', 'A', { roleEvaluateur: 'CADRE', statut: 'BROUILLON' }),
    ])
    expect(bilans.get('A')).toMatchObject({ nbNotants: 1, nbAttendus: 1, defaillants: [] })
  })

  it("ne compte pas un client externe qui aurait une affectation", () => {
    const bilans = bilansNotants([
      affectation('Q1', 'A', { roleEvaluateur: 'EXTERNE' }),
      affectation('Q2', 'A', { roleEvaluateur: 'EXTERNE', statut: 'EN_ATTENTE' }),
    ])
    expect(bilans.get('A')).toMatchObject({ nbNotants: 0, nbAttendus: 0, defaillants: [] })
  })

  it('ignore les auto-affectations', () => {
    expect(bilansNotants([affectation('A', 'A')]).has('A')).toBe(false)
  })
})

describe('compterSituations', () => {
  it('fait le bilan de clôture, sans compter les scores en règle historique', () => {
    const situations = ['COMPLET', 'COMPLET', 'PROTEGE', 'PENALISE', 'SANS_MANAGER', null] as const
    expect(compterSituations(situations.map((situation) => ({ situation })))).toEqual({
      complets: 2,
      proteges: 1,
      penalises: 1,
      nonClasses: 1,
    })
  })
})

describe('prevoirSituations', () => {
  it('prévoit la situation des notés et repère les managers dont la note manque', () => {
    const affectations = [
      affectation('M', 'A', { roleEvaluateur: 'MANAGER', statut: 'EN_ATTENTE' }),
      affectation('C1', 'A'),
      affectation('M', 'B', { roleEvaluateur: 'MANAGER' }),
      affectation('C1', 'B', { statut: 'EN_ATTENTE' }),
      affectation('B', 'C1'), // C1 n'est pas un noté suivi
    ]
    const { previsions, managersEnRetard } = prevoirSituations(affectations, 3, (id) => id !== 'C1')
    expect(previsions.map((p) => [p.evalueId, p.situation])).toEqual([
      ['A', 'SANS_MANAGER'],
      ['B', 'PENALISE'],
    ])
    expect(managersEnRetard).toEqual(new Map([['M', 1]]))
  })
})

describe('resumerBilanCloture', () => {
  it('résume le bilan en une phrase', () => {
    expect(resumerBilanCloture({ complets: 2, proteges: 1, penalises: 0, nonClasses: 3 })).toBe(
      '2 complets, 1 protégé, 0 pénalisé, 3 non classés.'
    )
  })

  it('ne dit rien en règle historique ou sans bilan', () => {
    expect(resumerBilanCloture({ complets: 0, proteges: 0, penalises: 0, nonClasses: 0 })).toBe('')
    expect(resumerBilanCloture(undefined)).toBe('')
  })
})

describe('estClasse', () => {
  it("n'exclut que les notés sans note du manager", () => {
    expect(estClasse('SANS_MANAGER')).toBe(false)
    expect(estClasse('PENALISE')).toBe(true)
    expect(estClasse(null)).toBe(true)
  })
})

describe('lireSeuilNotants', () => {
  it('accepte la règle historique (null ou vide) et les entiers de 1 à 20', () => {
    expect(lireSeuilNotants(null)).toBeNull()
    expect(lireSeuilNotants('')).toBeNull()
    expect(lireSeuilNotants(1)).toBe(1)
    expect(lireSeuilNotants('4')).toBe(4)
    expect(lireSeuilNotants(20)).toBe(20)
  })

  it('refuse 0, plus de 20, les décimaux et le texte', () => {
    for (const valeur of [0, 21, 2.5, 'trois', true, {}]) {
      expect(lireSeuilNotants(valeur)).toBeUndefined()
    }
  })
})
