import { describe, expect, it } from 'vitest'
import {
  anneeDuPalmaresAnnuel,
  datePublicationAnnuelle,
  delaiAvantPublication,
  depuisSaisieLocale,
  ecranDesResultats,
  formaterTempsRestant,
  lireDateResultats,
  versSaisieLocale,
} from '@/lib/publication-resultats'

const SECONDE = 1000
const MINUTE = 60 * SECONDE
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE

describe('lireDateResultats', () => {
  it('lit une date et une heure au format ISO', () => {
    expect(lireDateResultats('2026-11-20T18:30:00.000Z')).toEqual(new Date('2026-11-20T18:30:00.000Z'))
  })

  it('comprend une valeur vide comme « pas de date » : les résultats ne sont pas retenus', () => {
    expect(lireDateResultats(null)).toBeNull()
    expect(lireDateResultats('')).toBeNull()
  })

  it('lit une heure donnée avec son décalage horaire', () => {
    expect(lireDateResultats('2026-11-20T19:30:00+01:00')).toEqual(new Date('2026-11-20T18:30:00.000Z'))
  })

  it('refuse une date illisible', () => {
    expect(lireDateResultats('demain soir')).toBeUndefined()
    expect(lireDateResultats('2026-13-45T18:30:00.000Z')).toBeUndefined()
  })

  it('refuse une date approximative, que le serveur devinerait', () => {
    expect(lireDateResultats('2026')).toBeUndefined()
    expect(lireDateResultats('1')).toBeUndefined()
    expect(lireDateResultats('2026-11-20')).toBeUndefined()
  })

  it('refuse une heure sans fuseau horaire : elle changerait de sens selon le serveur', () => {
    expect(lireDateResultats('2026-11-20T18:30')).toBeUndefined()
  })

  it('refuse tout ce qui n’est pas un texte', () => {
    expect(lireDateResultats(1795372200000)).toBeUndefined()
    expect(lireDateResultats({ date: '2026-11-20' })).toBeUndefined()
    expect(lireDateResultats(undefined)).toBeUndefined()
  })
})

describe('anneeDuPalmaresAnnuel', () => {
  it('reconnaît l’identifiant d’un palmarès annuel', () => {
    expect(anneeDuPalmaresAnnuel('ANNUEL_2026')).toBe(2026)
  })

  it('ne confond pas une campagne avec un palmarès annuel', () => {
    expect(anneeDuPalmaresAnnuel('3f2b6c1e-8a57-4d0e-9a41-2f6f0c9d1e77')).toBeNull()
  })

  it('écarte une année mal formée', () => {
    expect(anneeDuPalmaresAnnuel('ANNUEL_')).toBeNull()
    expect(anneeDuPalmaresAnnuel('ANNUEL_26')).toBeNull()
    expect(anneeDuPalmaresAnnuel('ANNUEL_2026abc')).toBeNull()
    expect(anneeDuPalmaresAnnuel('ANNUEL_999999')).toBeNull()
  })
})

describe('delaiAvantPublication', () => {
  const publication = new Date('2026-11-20T18:00:00.000Z')

  it('donne le temps qui reste tant que le moment n’est pas arrivé', () => {
    expect(delaiAvantPublication(publication, new Date('2026-11-20T17:59:59.000Z'))).toBe(SECONDE)
    expect(delaiAvantPublication(publication, new Date('2026-11-18T18:00:00.000Z'))).toBe(2 * JOUR)
  })

  it('ne retient plus les résultats à l’instant exact prévu', () => {
    expect(delaiAvantPublication(publication, new Date('2026-11-20T18:00:00.000Z'))).toBe(0)
  })

  it('ne retient plus les résultats une fois le moment passé', () => {
    expect(delaiAvantPublication(publication, new Date('2026-11-21T08:00:00.000Z'))).toBe(0)
  })

  it('ne retient rien quand aucune date n’est fixée', () => {
    expect(delaiAvantPublication(null, new Date('2026-11-20T08:00:00.000Z'))).toBe(0)
  })
})

describe('ecranDesResultats', () => {
  const publication = new Date('2026-11-20T18:00:00.000Z')
  const avant = new Date('2026-11-20T17:59:59.000Z')
  const apres = new Date('2026-11-20T18:00:00.000Z')
  const VISITEUR = false
  const ADMIN = true

  it('montre les résultats à tout le monde, sans connexion, une fois la date de publication arrivée', () => {
    expect(ecranDesResultats(publication, apres, VISITEUR)).toBe('RESULTATS')
    expect(ecranDesResultats(publication, apres, ADMIN)).toBe('RESULTATS')
  })

  it('fait patienter tout le monde, administrateur compris, avant la date de publication', () => {
    expect(ecranDesResultats(publication, avant, VISITEUR)).toBe('ATTENTE')
    expect(ecranDesResultats(publication, avant, ADMIN)).toBe('ATTENTE')
  })

  it('ne montre rien au public tant qu’aucune date de publication n’est fixée', () => {
    expect(ecranDesResultats(null, apres, VISITEUR)).toBe('NON_PUBLIES')
  })

  it('laisse l’administrateur préparer la révélation quand aucune date n’est fixée', () => {
    expect(ecranDesResultats(null, apres, ADMIN)).toBe('RESULTATS')
  })
})

describe('datePublicationAnnuelle', () => {
  const mars = new Date('2026-03-20T18:00:00.000Z')
  const juin = new Date('2026-06-20T18:00:00.000Z')
  const VISITEUR = false
  const ADMIN = true

  it('attend la dernière campagne à être publiée', () => {
    expect(datePublicationAnnuelle([juin, mars], VISITEUR)).toEqual(juin)
    expect(datePublicationAnnuelle([mars, juin], ADMIN)).toEqual(juin)
  })

  it('n’est pas publié pour le public tant qu’une campagne de l’année n’a pas sa date', () => {
    expect(datePublicationAnnuelle([mars, null], VISITEUR)).toBeNull()
  })

  it('suit, pour l’administrateur, les seules campagnes qui ont une date', () => {
    expect(datePublicationAnnuelle([mars, null], ADMIN)).toEqual(mars)
  })

  it('n’a pas de date quand aucune campagne n’en a, ou que l’année n’a pas de campagne terminée', () => {
    expect(datePublicationAnnuelle([null, null], ADMIN)).toBeNull()
    expect(datePublicationAnnuelle([], VISITEUR)).toBeNull()
  })
})

describe('saisie de la date dans le formulaire', () => {
  it('présente la date au format attendu par le champ « jour et heure »', () => {
    expect(versSaisieLocale('2026-11-20T18:30:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('laisse le champ vide quand aucune date n’est fixée', () => {
    expect(versSaisieLocale(null)).toBe('')
    expect(versSaisieLocale(undefined)).toBe('')
    expect(versSaisieLocale('illisible')).toBe('')
  })

  it('retrouve le même instant après un aller-retour par le formulaire', () => {
    const instant = '2026-11-20T18:30:00.000Z'
    expect(depuisSaisieLocale(versSaisieLocale(instant))).toBe(instant)
  })

  it('lit l’heure saisie comme une heure locale', () => {
    expect(depuisSaisieLocale('2026-11-20T18:30')).toBe(new Date(2026, 10, 20, 18, 30).toISOString())
  })

  it('n’envoie aucune date pour un champ vide', () => {
    expect(depuisSaisieLocale('')).toBeNull()
  })

  it('signale une saisie illisible au lieu d’effacer la date', () => {
    expect(depuisSaisieLocale('pas une date')).toBeUndefined()
  })
})

describe('formaterTempsRestant', () => {
  it('n’affiche que les secondes sous la minute', () => {
    expect(formaterTempsRestant(5 * SECONDE)).toBe('5 s')
  })

  it('affiche minutes et secondes sous l’heure', () => {
    expect(formaterTempsRestant(4 * MINUTE + 5 * SECONDE)).toBe('4 min 05 s')
  })

  it('affiche heures, minutes et secondes sous la journée', () => {
    expect(formaterTempsRestant(3 * HEURE + 4 * MINUTE + 5 * SECONDE)).toBe('3 h 04 min 05 s')
  })

  it('affiche les jours au-delà', () => {
    expect(formaterTempsRestant(2 * JOUR + 3 * HEURE + 4 * MINUTE + 5 * SECONDE)).toBe('2 j 03 h 04 min 05 s')
  })

  it('arrondit à la seconde supérieure : on n’affiche jamais 0 avant l’heure', () => {
    expect(formaterTempsRestant(1)).toBe('1 s')
    expect(formaterTempsRestant(59 * SECONDE + 1)).toBe('1 min 00 s')
  })

  it('s’arrête à zéro', () => {
    expect(formaterTempsRestant(0)).toBe('0 s')
    expect(formaterTempsRestant(-5 * SECONDE)).toBe('0 s')
  })
})
