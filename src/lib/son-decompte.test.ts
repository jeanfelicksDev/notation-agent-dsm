import { describe, expect, it } from 'vitest'
import { noteDuDecompte } from '@/lib/son-decompte'

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
