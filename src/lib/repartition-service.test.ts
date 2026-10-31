import { describe, expect, it } from 'vitest'
import { pairesManagersDuService } from '@/lib/repartition-service'

const agent = (id: string, role: string, service: string | null) => ({ id, role, service })

describe('pairesManagersDuService', () => {
  it('fait noter par chaque manager tous les Pairs de son service', () => {
    const { paires } = pairesManagersDuService([
      agent('m1', 'MANAGER', 'Quai'),
      agent('p1', 'UTILISATEUR', 'Quai'),
      agent('p2', 'UTILISATEUR', 'Quai'),
      agent('p3', 'UTILISATEUR', 'Douane'),
    ])
    expect(paires).toEqual([
      { evaluateurId: 'm1', evalueId: 'p1' },
      { evaluateurId: 'm1', evalueId: 'p2' },
    ])
  })

  it('donne aux Pairs d’un service tous ses managers quand il y en a plusieurs', () => {
    const { paires } = pairesManagersDuService([
      agent('m1', 'MANAGER', 'Quai'),
      agent('m2', 'MANAGER', 'Quai'),
      agent('p1', 'UTILISATEUR', 'Quai'),
    ])
    expect(paires).toEqual([
      { evaluateurId: 'm1', evalueId: 'p1' },
      { evaluateurId: 'm2', evalueId: 'p1' },
    ])
  })

  it('ne fait noter que les Pairs : ni managers, ni cadres, ni non-éligibles, ni externes', () => {
    const { paires } = pairesManagersDuService([
      agent('m1', 'MANAGER', 'Quai'),
      agent('m2', 'MANAGER', 'Quai'),
      agent('c1', 'CADRE', 'Quai'),
      agent('n1', 'NON_ELIGIBLE', 'Quai'),
      agent('x1', 'EXTERNE', 'Quai'),
    ])
    expect(paires).toEqual([])
  })

  it('rapproche les services sans tenir compte des espaces superflus', () => {
    const { paires } = pairesManagersDuService([agent('m1', 'MANAGER', ' Quai '), agent('p1', 'UTILISATEUR', 'Quai')])
    expect(paires).toEqual([{ evaluateurId: 'm1', evalueId: 'p1' }])
  })

  it('compte les managers sans service, qui ne reçoivent personne', () => {
    const { paires, managersSansService } = pairesManagersDuService([
      agent('m1', 'MANAGER', null),
      agent('m2', 'MANAGER', '  '),
      agent('p1', 'UTILISATEUR', null),
    ])
    expect(paires).toEqual([])
    expect(managersSansService).toBe(2)
  })
})
