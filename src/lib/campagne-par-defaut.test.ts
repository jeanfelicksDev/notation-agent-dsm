import { describe, expect, it } from 'vitest'
import { campagneParDefaut } from '@/lib/campagne-par-defaut'

const campagne = (id: string, statut: string) => ({ id, statut })

describe('campagneParDefaut', () => {
  it('retient la campagne ouverte, même si une autre est plus récente', () => {
    const campagnes = [campagne('recente', 'CALCULEE'), campagne('ouverte', 'OUVERTE'), campagne('ancienne', 'CLOTUREE')]
    expect(campagneParDefaut(campagnes)?.id).toBe('ouverte')
  })

  it('retient la plus récente quand aucune campagne n’est ouverte', () => {
    const campagnes = [campagne('recente', 'CALCULEE'), campagne('ancienne', 'CLOTUREE')]
    expect(campagneParDefaut(campagnes)?.id).toBe('recente')
  })

  it('ne renvoie rien quand il n’existe aucune campagne', () => {
    expect(campagneParDefaut([])).toBeNull()
  })
})
