// Tests de src/lib/commentaires.ts — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  commentaireObligatoire,
  construireFicheRetours,
  tonalite,
} from '../src/lib/commentaires.ts'

let seq = 0
const note = (contributeur, source, critereId, valeur, commentaire = null, noteMaximale = 5) => ({
  id: `n${++seq}`,
  contributeur,
  source,
  critereId,
  critereLibelle: critereId,
  valeur,
  noteMaximale,
  commentaire,
})

test('commentaire obligatoire pour une note de 2 ou moins sur 5, 4 ou moins sur 10', () => {
  assert.equal(commentaireObligatoire(1, 5), true)
  assert.equal(commentaireObligatoire(2, 5), true)
  assert.equal(commentaireObligatoire(3, 5), false)
  assert.equal(commentaireObligatoire(4, 10), true)
  assert.equal(commentaireObligatoire(5, 10), false)
  assert.equal(commentaireObligatoire(0, 5), false, 'pas encore noté')
})

test('tonalité : reproche, neutre, point fort', () => {
  assert.equal(tonalite(2, 5), 'reproche')
  assert.equal(tonalite(3, 5), 'neutre')
  assert.equal(tonalite(4, 5), 'point_fort')
  assert.equal(tonalite(8, 10), 'point_fort')
})

test('un commentaire est montré avec sa source quand 3 notants de cette source ont noté le critère', () => {
  const fiche = construireFicheRetours([
    note('c1', 'COLLEGUE', 'equipe', 2, 'Ne partage pas les infos'),
    note('c2', 'COLLEGUE', 'equipe', 4),
    note('c3', 'COLLEGUE', 'equipe', 5),
  ])
  assert.equal(fiche.masques, 0)
  assert.equal(fiche.criteres[0].commentaires[0].provenance, 'Collègues')
  assert.equal(fiche.criteres[0].commentaires[0].tonalite, 'reproche')
})

test('un critère noté par le seul manager : commentaire masqué', () => {
  const fiche = construireFicheRetours([note('m1', 'MANAGER', 'regles', 1, 'Retards répétés')])
  assert.equal(fiche.criteres.length, 0)
  assert.equal(fiche.masques, 1)
})

test('un client interne isolé est fondu dans « Retour interne » quand la famille compte 3 notants', () => {
  const fiche = construireFicheRetours([
    note('ci1', 'CLIENT_INTERNE', 'service', 2, 'Délais trop longs'),
    note('c1', 'COLLEGUE', 'service', 4),
    note('c2', 'COLLEGUE', 'service', 4),
  ])
  assert.equal(fiche.criteres[0].commentaires[0].provenance, 'Retour interne')
})

test('interne et client mélangés sous le seuil par famille : provenance générique', () => {
  const fiche = construireFicheRetours([
    note('k1', 'CLIENT', 'accueil', 1, 'Accueil froid'),
    note('k2', 'CLIENT', 'accueil', 3),
    note('c1', 'COLLEGUE', 'accueil', 4),
  ])
  assert.equal(fiche.criteres[0].commentaires[0].provenance, 'Retour')
})

test('les commentaires déposés sous des critères différents ne se cumulent pas pour le seuil', () => {
  const fiche = construireFicheRetours([
    note('c1', 'COLLEGUE', 'a', 2, 'x'),
    note('c2', 'COLLEGUE', 'b', 2, 'y'),
    note('c3', 'COLLEGUE', 'c', 2, 'z'),
  ])
  assert.equal(fiche.masques, 3)
})

test('la fiche ne contient ni identifiant de notant ni identifiant de note', () => {
  const fiche = construireFicheRetours([
    note('secret-evaluateur-1', 'COLLEGUE', 'equipe', 2, 'A'),
    note('secret-evaluateur-2', 'COLLEGUE', 'equipe', 4, 'B'),
    note('secret-evaluateur-3', 'COLLEGUE', 'equipe', 5, 'C'),
  ])
  const json = JSON.stringify(fiche)
  assert.ok(!json.includes('secret-evaluateur'))
  assert.ok(!/"n\d+"/.test(json))
})

test('reproches d’abord, puis neutres, puis points forts ; totaux cohérents', () => {
  const fiche = construireFicheRetours([
    note('c1', 'COLLEGUE', 'equipe', 5, 'Très aidant'),
    note('c2', 'COLLEGUE', 'equipe', 3, 'Correct'),
    note('c3', 'COLLEGUE', 'equipe', 1, 'Absent'),
  ])
  assert.deepEqual(fiche.criteres[0].commentaires.map((c) => c.tonalite), ['reproche', 'neutre', 'point_fort'])
  assert.deepEqual(fiche.totaux, { reproche: 1, neutre: 1, point_fort: 1 })
})

test('les commentaires vides ou faits d’espaces sont ignorés', () => {
  const fiche = construireFicheRetours([
    note('c1', 'COLLEGUE', 'equipe', 2, '   '),
    note('c2', 'COLLEGUE', 'equipe', 2, ''),
    note('c3', 'COLLEGUE', 'equipe', 2),
  ])
  assert.equal(fiche.criteres.length, 0)
  assert.equal(fiche.masques, 0)
})
