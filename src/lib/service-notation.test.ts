import { describe, expect, it } from 'vitest'
import { memeServiceDeNotation, serviceDeNotation } from '@/lib/service-notation'
import { criteresPourPaire } from '@/lib/criteres'
import { pairesManagersDuService } from '@/lib/repartition-service'

describe('serviceDeNotation', () => {
  it('regroupe Magasin et Matériel en Magasin-Matériel', () => {
    expect(serviceDeNotation('Magasin')).toBe('Magasin-Matériel')
    expect(serviceDeNotation('Matériel')).toBe('Magasin-Matériel')
  })

  it('reconnaît les sous-services sans tenir compte des accents, de la casse ni des espaces', () => {
    expect(serviceDeNotation(' materiel ')).toBe('Magasin-Matériel')
    expect(serviceDeNotation('MAGASIN')).toBe('Magasin-Matériel')
  })

  it('laisse les autres services inchangés (espaces superflus retirés)', () => {
    expect(serviceDeNotation(' OOCL ')).toBe('OOCL')
    expect(serviceDeNotation(null)).toBe('')
  })

  it('compare deux agents sur leur service de notation', () => {
    expect(memeServiceDeNotation('Magasin', 'Matériel')).toBe(true)
    expect(memeServiceDeNotation('Magasin', 'OOCL')).toBe(false)
    expect(memeServiceDeNotation(null, undefined)).toBe(true)
  })
})

describe('regroupement Magasin-Matériel dans la notation', () => {
  const criteres = [
    { id: 'col', typeEvaluateur: 'COLLEGUE' },
    { id: 'ci', typeEvaluateur: 'CLIENT_INTERNE' },
  ]

  it('un Pair du Magasin note un Pair du Matériel en collègue', () => {
    const ids = criteresPourPaire(criteres, { role: 'UTILISATEUR', service: 'Magasin' }, { service: 'Matériel' }).map((c) => c.id)
    expect(ids).toEqual(['col'])
  })

  it('un Pair d’un autre service reste client interne', () => {
    const ids = criteresPourPaire(criteres, { role: 'UTILISATEUR', service: 'OOCL' }, { service: 'Matériel' }).map((c) => c.id)
    expect(ids).toEqual(['ci'])
  })

  it('le manager du Magasin note aussi les Pairs du Matériel', () => {
    const { paires } = pairesManagersDuService([
      { id: 'm1', role: 'MANAGER', service: 'Magasin' },
      { id: 'p1', role: 'UTILISATEUR', service: 'Magasin' },
      { id: 'p2', role: 'UTILISATEUR', service: 'Matériel' },
      { id: 'p3', role: 'UTILISATEUR', service: 'Dépôt' },
    ])
    expect(paires).toEqual([
      { evaluateurId: 'm1', evalueId: 'p1' },
      { evaluateurId: 'm1', evalueId: 'p2' },
    ])
  })
})
