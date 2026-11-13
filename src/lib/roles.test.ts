import { describe, expect, it } from 'vitest'
import { estNonEligible, estRole, libelleRole, participeACampagne, ROLES_A_PIN } from '@/lib/roles'

describe('rôle Non-éligible', () => {
  it('est un rôle connu, libellé « Non-éligible »', () => {
    expect(estRole('NON_ELIGIBLE')).toBe(true)
    expect(libelleRole('NON_ELIGIBLE')).toBe('Non-éligible')
  })

  it('ne se connecte pas : aucun PIN à définir', () => {
    expect(ROLES_A_PIN).not.toContain('NON_ELIGIBLE')
  })

  it('est reconnu par estNonEligible, et lui seul', () => {
    expect(estNonEligible('NON_ELIGIBLE')).toBe(true)
    for (const role of ['UTILISATEUR', 'MANAGER', 'CADRE', 'EXTERNE', 'ADMIN', null, undefined]) {
      expect(estNonEligible(role)).toBe(false)
    }
  })
})

describe('participeACampagne', () => {
  it('exclut les non-éligibles des affectations, comme notant ou comme noté', () => {
    expect(participeACampagne('NON_ELIGIBLE')).toBe(false)
  })

  it('garde les pairs, managers, cadres et clients externes', () => {
    for (const role of ['UTILISATEUR', 'MANAGER', 'CADRE', 'EXTERNE']) {
      expect(participeACampagne(role)).toBe(true)
    }
  })
})
