import { describe, expect, it } from 'vitest'
import { courbeQuotidienne, pourcentage, SANS_SERVICE, tauxParService, type AffectationParticipation } from '@/lib/participation'

const aff = (
  evaluateurId: string,
  service: string | null,
  termineeAt: string | null = null,
  statut = termineeAt ? 'TERMINEE' : 'EN_ATTENTE'
): AffectationParticipation => ({ evaluateurId, service, statut, termineeAt: termineeAt ? new Date(termineeAt) : null })

const AFFECTATIONS = [
  aff('a', 'Transit', '2026-11-02T09:00:00Z'),
  aff('a', 'Transit', '2026-11-02T09:00:00Z'),
  aff('b', 'Transit', '2026-11-02T15:30:00Z'),
  aff('c', 'Transit'),
  aff('d', 'Douane', '2026-11-04T08:00:00Z'),
  aff('e', 'Douane', null, 'BROUILLON'),
  aff('f', null),
]

describe('pourcentage', () => {
  it('renvoie 0 quand rien n’est attendu', () => {
    expect(pourcentage(0, 0)).toBe(0)
  })

  it('arrondit à l’entier', () => {
    expect(pourcentage(1, 3)).toBe(33)
  })
})

describe('tauxParService', () => {
  it('compte les affectations soumises par service du notant, du plus avancé au moins avancé', () => {
    expect(tauxParService(AFFECTATIONS)).toEqual([
      { service: 'Transit', total: 4, soumises: 3, taux: 75 },
      { service: 'Douane', total: 2, soumises: 1, taux: 50 },
      { service: SANS_SERVICE, total: 1, soumises: 0, taux: 0 },
    ])
  })

  it('regroupe les services vides sous « Sans service »', () => {
    expect(tauxParService([aff('x', '  '), aff('y', null)])).toEqual([{ service: SANS_SERVICE, total: 2, soumises: 0, taux: 0 }])
  })
})

describe('courbeQuotidienne', () => {
  const periode = { debut: new Date('2026-11-01T00:00:00Z'), fin: new Date('2026-11-16T00:00:00Z') }

  it('donne un point par jour, du début de la campagne à aujourd’hui', () => {
    const points = courbeQuotidienne(AFFECTATIONS, periode, new Date('2026-11-05T12:00:00Z'))
    expect(points.map((p) => p.jour)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'])
  })

  it('compte les notants distincts du jour et le taux cumulé à la fin du jour', () => {
    const points = courbeQuotidienne(AFFECTATIONS, periode, new Date('2026-11-05T12:00:00Z'))
    expect(points[1]).toEqual({ jour: '2026-11-02', notants: 2, soumises: 3, taux: 43 })
    expect(points[2]).toEqual({ jour: '2026-11-03', notants: 0, soumises: 0, taux: 43 })
    expect(points[3]).toEqual({ jour: '2026-11-04', notants: 1, soumises: 1, taux: 57 })
  })

  it('s’arrête à la clôture une fois la campagne terminée', () => {
    const points = courbeQuotidienne([], periode, new Date('2026-12-20T00:00:00Z'))
    expect(points.at(-1)?.jour).toBe('2026-11-16')
    expect(points).toHaveLength(16)
  })

  it('est vide avant l’ouverture de la campagne', () => {
    expect(courbeQuotidienne(AFFECTATIONS, periode, new Date('2026-10-20T00:00:00Z'))).toEqual([])
  })
})
