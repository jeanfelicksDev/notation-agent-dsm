import { describe, expect, it } from 'vitest'
import { distinctionSelonPosition, LIBELLES_DISTINCTION, officiers } from '@/lib/distinctions'

describe('distinctionSelonPosition', () => {
  it('attribue Captain, Chief officer et 2nd officer aux trois premiers du classement général', () => {
    expect([0, 1, 2].map(distinctionSelonPosition)).toEqual(['CAPTAIN', 'CHIEF_OFFICER', 'SECOND_OFFICER'])
  })

  it("n'attribue rien à partir du 4e", () => {
    expect(distinctionSelonPosition(3)).toBeNull()
    expect(distinctionSelonPosition(40)).toBeNull()
  })
})

describe('officiers', () => {
  it('désigne les officiers dans l’ordre du classement général', () => {
    expect(officiers(['awa', 'koffi', 'ines', 'yao'])).toEqual({ captain: 'awa', chiefOfficer: 'koffi', secondOfficer: 'ines' })
  })

  it('laisse vacantes les distinctions sans agent classé', () => {
    expect(officiers(['awa'])).toEqual({ captain: 'awa', chiefOfficer: null, secondOfficer: null })
    expect(officiers([])).toEqual({ captain: null, chiefOfficer: null, secondOfficer: null })
  })
})

describe('LIBELLES_DISTINCTION', () => {
  it('indique le rang de chaque officier', () => {
    expect(LIBELLES_DISTINCTION.CHIEF_OFFICER).toEqual({ titre: 'Chief officer', rang: '2e toutes entités confondues' })
  })
})
