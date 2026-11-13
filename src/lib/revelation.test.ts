import { describe, expect, it } from 'vitest'
import {
  avancer,
  DEBUT_DECOMPTE,
  DELAI_ENTRE_CARTES_MS,
  delaiAvantSuite,
  DUREE_APPARITION_CARTE_MS,
  dureeApparition,
  estRevele,
  ETAT_INITIAL,
  lancerDecompte,
  ORDRE_REVELATION,
  PAUSE_ENTRE_NIVEAUX_MS,
  revelationTerminee,
  type EtatRevelation,
} from '@/lib/revelation'

/** Fait défiler le décompte complet : de 5 à 0, puis la révélation du premier niveau. */
function terminerDecompte(etat: EtatRevelation): EtatRevelation {
  let courant = etat
  while (courant.decompte !== null) courant = avancer(courant)
  return courant
}

const reveles = (etat: EtatRevelation) => ORDRE_REVELATION.map((niveau) => estRevele(etat, niveau))

describe('ordre de révélation', () => {
  it('garde le Captain pour la fin', () => {
    expect(ORDRE_REVELATION).toEqual(['SECOND_OFFICER', 'CHIEF_OFFICER', 'CAPTAIN'])
  })

  it('ne révèle rien au départ', () => {
    expect(reveles(ETAT_INITIAL)).toEqual([false, false, false])
    expect(revelationTerminee(ETAT_INITIAL)).toBe(false)
  })
})

describe('lancerDecompte', () => {
  it('démarre le décompte à 5', () => {
    expect(DEBUT_DECOMPTE).toBe(5)
    expect(lancerDecompte(ETAT_INITIAL)).toEqual({ niveauxReveles: 0, decompte: 5 })
  })

  it('ne relance pas un décompte déjà en cours', () => {
    const enCours: EtatRevelation = { niveauxReveles: 0, decompte: 2 }
    expect(lancerDecompte(enCours)).toEqual(enCours)
  })

  it('ne relance rien une fois la révélation commencée : la suite s’enchaîne seule', () => {
    const premierNiveauRevele: EtatRevelation = { niveauxReveles: 1, decompte: null }
    expect(lancerDecompte(premierNiveauRevele)).toEqual(premierNiveauRevele)
  })

  it("ne modifie pas l'état reçu", () => {
    lancerDecompte(ETAT_INITIAL)
    expect(ETAT_INITIAL).toEqual({ niveauxReveles: 0, decompte: null })
  })
})

describe('avancer', () => {
  it('affiche 5, 4, 3, 2, 1 puis 0 avant de révéler le premier niveau', () => {
    const affiches: number[] = []
    let etat = lancerDecompte(ETAT_INITIAL)
    while (etat.decompte !== null) {
      affiches.push(etat.decompte)
      expect(reveles(etat)).toEqual([false, false, false])
      etat = avancer(etat)
    }
    expect(affiches).toEqual([5, 4, 3, 2, 1, 0])
    expect(reveles(etat)).toEqual([true, false, false])
  })

  it('n’avance pas tant que le décompte n’a pas été lancé', () => {
    expect(avancer(ETAT_INITIAL)).toEqual(ETAT_INITIAL)
  })

  it('révèle ensuite les niveaux un par un, sans nouveau décompte', () => {
    const premier = terminerDecompte(lancerDecompte(ETAT_INITIAL))

    const deuxieme = avancer(premier)
    expect(deuxieme.decompte).toBeNull()
    expect(reveles(deuxieme)).toEqual([true, true, false])

    const troisieme = avancer(deuxieme)
    expect(reveles(troisieme)).toEqual([true, true, true])
    expect(revelationTerminee(troisieme)).toBe(true)
    expect(avancer(troisieme)).toEqual(troisieme)
  })
})

describe('rythme des cartes', () => {
  it('fait apparaître les noms à une seconde d’intervalle', () => {
    expect(DELAI_ENTRE_CARTES_MS).toBe(1000)
  })

  it('donne à chaque nom une apparition lente, plus longue que l’intervalle', () => {
    expect(DUREE_APPARITION_CARTE_MS).toBeGreaterThan(DELAI_ENTRE_CARTES_MS)
  })
})

describe('dureeApparition', () => {
  it('compte une apparition pour une carte seule', () => {
    expect(dureeApparition(1)).toBe(DUREE_APPARITION_CARTE_MS)
  })

  it('ajoute le décalage de la cascade pour chaque carte suivante', () => {
    expect(dureeApparition(4)).toBe(3 * DELAI_ENTRE_CARTES_MS + DUREE_APPARITION_CARTE_MS)
  })

  it('vaut zéro pour un niveau sans lauréat', () => {
    expect(dureeApparition(0)).toBe(0)
  })
})

describe('delaiAvantSuite', () => {
  it('attend le lancement au départ', () => {
    expect(delaiAvantSuite(ETAT_INITIAL, 0)).toBeNull()
  })

  it('fait battre le décompte toutes les secondes', () => {
    expect(delaiAvantSuite({ niveauxReveles: 0, decompte: 5 }, 0)).toBe(1000)
    expect(delaiAvantSuite({ niveauxReveles: 0, decompte: 0 }, 0)).toBe(1000)
  })

  it('laisse apparaître le niveau, puis attend 3 secondes avant le suivant', () => {
    expect(PAUSE_ENTRE_NIVEAUX_MS).toBe(3000)
    expect(delaiAvantSuite({ niveauxReveles: 1, decompte: null }, 12)).toBe(dureeApparition(12) + 3000)
    expect(delaiAvantSuite({ niveauxReveles: 2, decompte: null }, 4)).toBe(dureeApparition(4) + 3000)
  })

  it('passe sans attendre un niveau sans lauréat, qui n’affiche rien', () => {
    expect(delaiAvantSuite({ niveauxReveles: 1, decompte: null }, 0)).toBe(0)
  })

  it('s’arrête quand le Captain est révélé', () => {
    expect(delaiAvantSuite({ niveauxReveles: 3, decompte: null }, 1)).toBeNull()
  })
})
