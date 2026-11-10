import { describe, expect, it } from 'vitest'
import { versPalmares, type ReponseClassement } from '@/lib/palmares-ceremonie'

const agent = (matricule: string, prenom: string, nom: string, service: string, departement: string, scoreTotal: number) => ({
  matricule,
  prenom,
  nom,
  service,
  departement,
  direction: 'DIRECTION SOLUTION MARITIME',
  scoreTotal,
  scoreManager: 90,
  scoreCollegues: 80,
})

const awa = agent('100', 'Awa', 'KONE', 'Magasin', 'Manutention', 87)
const koffi = agent('200', 'Koffi', 'YAO', 'Shipping', 'Consignation', 86.8)

const reponse: ReponseClassement = {
  campagne: { id: 'c1', libelle: '1ère campagne' },
  provisoire: true,
  laureats: {
    majorGlobal: awa,
    majorsDepartement: [
      { departementNom: 'Consignation', major: koffi },
      { departementNom: 'Manutention', major: awa },
    ],
    majorsService: [
      { serviceNom: 'Magasin', departementNom: 'Manutention', major: awa },
      { serviceNom: 'Shipping', departementNom: 'Consignation', major: koffi },
    ],
  },
}

describe('versPalmares', () => {
  it('reprend le libellé et le caractère provisoire de la campagne', () => {
    const palmares = versPalmares(reponse)
    expect(palmares.libelle).toBe('1ère campagne')
    expect(palmares.provisoire).toBe(true)
  })

  it('présente le Captain avec sa direction', () => {
    expect(versPalmares(reponse).niveaux.CAPTAIN).toEqual([
      { cle: 'DIRECTION SOLUTION MARITIME', entite: 'DIRECTION SOLUTION MARITIME', nomComplet: 'Awa KONE', precision: 'Magasin · Manutention', scoreTotal: 87 },
    ])
  })

  it('présente un Chief officer par département, du plus méritant au moins méritant', () => {
    expect(versPalmares(reponse).niveaux.CHIEF_OFFICER).toEqual([
      { cle: 'Manutention', entite: 'Manutention', nomComplet: 'Awa KONE', precision: 'Magasin', scoreTotal: 87 },
      { cle: 'Consignation', entite: 'Consignation', nomComplet: 'Koffi YAO', precision: 'Shipping', scoreTotal: 86.8 },
    ])
  })

  it('range aussi les 2nd officers par ordre de mérite, quel que soit l’ordre reçu', () => {
    const inverse: ReponseClassement = {
      ...reponse,
      laureats: { ...reponse.laureats, majorsService: [...reponse.laureats.majorsService].reverse() },
    }
    expect(versPalmares(inverse).niveaux.SECOND_OFFICER.map((laureat) => laureat.scoreTotal)).toEqual([87, 86.8])
  })

  it('départage deux scores égaux comme le classement : part manager, puis part collègues', () => {
    const egalite = (matricule: string, scoreManager: number, scoreCollegues: number) => ({
      ...agent(matricule, 'Agent', matricule, 'Service', 'Département', 80),
      scoreManager,
      scoreCollegues,
    })
    const palmares = versPalmares({
      ...reponse,
      laureats: {
        ...reponse.laureats,
        majorsService: [
          { serviceNom: 'Troisième', departementNom: 'D', major: egalite('C', 85, 70) },
          { serviceNom: 'Premier', departementNom: 'D', major: egalite('A', 95, 60) },
          { serviceNom: 'Deuxième', departementNom: 'D', major: egalite('B', 85, 75) },
        ],
      },
    })
    expect(palmares.niveaux.SECOND_OFFICER.map((laureat) => laureat.entite)).toEqual(['Premier', 'Deuxième', 'Troisième'])
  })

  it('présente un 2nd officer par service', () => {
    expect(versPalmares(reponse).niveaux.SECOND_OFFICER).toEqual([
      { cle: 'Magasin', entite: 'Magasin', nomComplet: 'Awa KONE', precision: 'Manutention', scoreTotal: 87 },
      { cle: 'Shipping', entite: 'Shipping', nomComplet: 'Koffi YAO', precision: 'Consignation', scoreTotal: 86.8 },
    ])
  })

  it('laisse les niveaux vides quand aucun agent n’est classé', () => {
    const vide = versPalmares({
      campagne: { id: 'c1', libelle: 'Campagne vide' },
      provisoire: false,
      laureats: { majorGlobal: null, majorsDepartement: [], majorsService: [] },
    })
    expect(vide.niveaux).toEqual({ CAPTAIN: [], CHIEF_OFFICER: [], SECOND_OFFICER: [] })
    expect(vide.aucunLaureat).toBe(true)
  })

  it('signale la présence de lauréats', () => {
    expect(versPalmares(reponse).aucunLaureat).toBe(false)
  })
})
