import { describe, expect, it } from 'vitest'
import { distinctionsDe, libelleComplet, LIBELLES_DISTINCTION } from '@/lib/distinctions'

describe('distinctionsDe', () => {
  it('nomme Chief officer le premier de son département', () => {
    expect(distinctionsDe({ direction: false, departement: true, service: false })).toEqual(['CHIEF_OFFICER'])
  })

  it('nomme 2nd officer le premier de son service', () => {
    expect(distinctionsDe({ direction: false, departement: false, service: true })).toEqual(['SECOND_OFFICER'])
  })

  it('cumule les distinctions du premier de la direction, du Captain au 2nd officer', () => {
    expect(distinctionsDe({ direction: true, departement: true, service: true })).toEqual([
      'CAPTAIN',
      'CHIEF_OFFICER',
      'SECOND_OFFICER',
    ])
  })

  it("n'attribue rien à un agent qui n'est premier d'aucune entité", () => {
    expect(distinctionsDe({ direction: false, departement: false, service: false })).toEqual([])
  })
})

describe('libelleComplet', () => {
  it("associe le titre à l'entité récompensée", () => {
    expect(libelleComplet('CHIEF_OFFICER')).toBe('Chief officer (meilleur agent du département)')
    expect(libelleComplet('SECOND_OFFICER')).toBe('2nd officer (meilleur agent du service)')
  })
})

describe('LIBELLES_DISTINCTION', () => {
  it("indique l'entité récompensée par chaque distinction", () => {
    expect(LIBELLES_DISTINCTION.CAPTAIN).toEqual({ titre: 'Captain', portee: 'Meilleur agent de la direction' })
    expect(LIBELLES_DISTINCTION.CHIEF_OFFICER).toEqual({ titre: 'Chief officer', portee: 'Meilleur agent du département' })
    expect(LIBELLES_DISTINCTION.SECOND_OFFICER).toEqual({ titre: '2nd officer', portee: 'Meilleur agent du service' })
  })
})
