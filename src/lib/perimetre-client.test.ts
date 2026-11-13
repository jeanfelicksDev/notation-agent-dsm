import { describe, expect, it } from 'vitest'
import { coordonneeClient, filtreAgentsEvaluables } from '@/lib/perimetre-client'

describe('filtreAgentsEvaluables', () => {
  it('limite le client aux agents qui lui sont affectés, QR activé ou non', () => {
    expect(filtreAgentsEvaluables(['a1', 'a2'])).toEqual({
      role: { in: ['UTILISATEUR', 'MANAGER'] },
      id: { in: ['a1', 'a2'] },
    })
  })

  it('ouvre à tous les agents dont le QR est activé quand le client n’a aucune affectation', () => {
    expect(filtreAgentsEvaluables([])).toEqual({
      role: { in: ['UTILISATEUR', 'MANAGER'] },
      qrcodeActif: true,
    })
  })
})

describe('coordonneeClient', () => {
  it('affiche le téléphone en priorité', () => {
    expect(coordonneeClient({ telephone: '0700000000', email: 'awa@exemple.ci' })).toBe('0700000000')
  })

  it('se rabat sur un vrai e-mail quand le téléphone manque', () => {
    expect(coordonneeClient({ telephone: null, email: 'awa@exemple.ci' })).toBe('awa@exemple.ci')
    expect(coordonneeClient({ telephone: '  ', email: 'awa@exemple.ci' })).toBe('awa@exemple.ci')
  })

  it('ignore les e-mails générés à l’import', () => {
    expect(coordonneeClient({ telephone: null, email: 'c0012@dsm.local' })).toBeNull()
    expect(coordonneeClient({})).toBeNull()
  })
})
