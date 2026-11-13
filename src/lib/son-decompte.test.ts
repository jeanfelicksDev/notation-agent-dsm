import { describe, expect, it } from 'vitest'
import { dureeFanfareMs, FANFARE_DU_GAGNANT, noteDuDecompte } from '@/lib/son-decompte'

describe('FANFARE_DU_GAGNANT', () => {
  it('commence dès la révélation du Captain', () => {
    expect(Math.min(...FANFARE_DU_GAGNANT.map((note) => note.debutMs))).toBe(0)
  })

  it('s’ouvre sur une montée de quatre notes', () => {
    const ouverture = FANFARE_DU_GAGNANT.slice(0, 4)
    const frequences = ouverture.map((note) => note.frequenceHz)
    expect(frequences).toEqual([...frequences].sort((a, b) => a - b))
    expect(new Set(frequences).size).toBe(4)
    expect(ouverture.map((note) => note.debutMs)).toEqual([...ouverture.map((note) => note.debutMs)].sort((a, b) => a - b))
  })

  it('se termine sur un accord tenu', () => {
    const dernierDebut = Math.max(...FANFARE_DU_GAGNANT.map((note) => note.debutMs))
    const accord = FANFARE_DU_GAGNANT.filter((note) => note.debutMs === dernierDebut)
    expect(accord.length).toBeGreaterThanOrEqual(3)
    expect(accord.every((note) => note.dureeMs >= 1000)).toBe(true)
  })

  it('dure quelques secondes', () => {
    expect(dureeFanfareMs()).toBeGreaterThan(2000)
    expect(dureeFanfareMs()).toBeLessThan(5000)
  })
})

describe('noteDuDecompte', () => {
  it('joue le même bip court pour 5, 4, 3, 2 et 1', () => {
    const bips = [5, 4, 3, 2, 1].map(noteDuDecompte)
    expect(new Set(bips.map((note) => JSON.stringify(note))).size).toBe(1)
  })

  it('marque le zéro par une note plus haute et plus longue', () => {
    const bip = noteDuDecompte(1)
    const finale = noteDuDecompte(0)
    expect(finale.frequenceHz).toBeGreaterThan(bip.frequenceHz)
    expect(finale.dureeMs).toBeGreaterThan(bip.dureeMs)
  })

  it('garde chaque bip plus court que la seconde qui sépare deux chiffres', () => {
    expect(noteDuDecompte(3).dureeMs).toBeLessThan(1000)
  })
})
