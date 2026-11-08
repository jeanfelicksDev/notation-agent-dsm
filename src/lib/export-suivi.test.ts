import { describe, expect, it } from 'vitest'
import { lignesExportSuivi, nomFichierSuivi, profilEvaluateur, type EvaluateurSuivi } from '@/lib/export-suivi'

const evaluateur = (
  matricule: string,
  role: string,
  statut: string,
  options: Partial<{ service: string | null; termineeAt: string | null; total: number }> = {}
): EvaluateurSuivi => ({
  user: { matricule, nom: `NOM${matricule}`, prenom: `Prenom ${matricule}`, role, service: options.service === undefined ? 'GSL' : options.service },
  statut,
  totalToEvaluate: options.total ?? 5,
  termineeAt: options.termineeAt ?? null,
})

describe('lignesExportSuivi', () => {
  it('donne le matricule, le nom, les prénoms et le service de chaque évaluateur, dans l’ordre de la liste', () => {
    const lignes = lignesExportSuivi([evaluateur('3561', 'UTILISATEUR', 'EN_ATTENTE'), evaluateur('7624', 'UTILISATEUR', 'EN_ATTENTE', { total: 8 })])
    expect(lignes.map((l) => [l.Matricule, l.Nom, l.Prénoms, l.Service])).toEqual([
      ['3561', 'NOM3561', 'Prenom 3561', 'GSL'],
      ['7624', 'NOM7624', 'Prenom 7624', 'GSL'],
    ])
    expect(lignes[1]).toMatchObject({ Profil: 'Pair', Statut: 'Non commencée', 'Évaluations à faire': 8, 'Soumis le': '' })
  })

  it('date la soumission des évaluations terminées (heure d’Abidjan)', () => {
    const [ligne] = lignesExportSuivi([evaluateur('7470', 'UTILISATEUR', 'TERMINEE', { termineeAt: '2026-11-03T09:18:35.141Z' })])
    expect(ligne).toMatchObject({ Statut: 'Terminée', 'Soumis le': '03/11/2026 09:18' })
  })

  it('laisse vide le service d’un client externe', () => {
    const [ligne] = lignesExportSuivi([evaluateur('C001', 'EXTERNE', 'BROUILLON', { service: null })])
    expect(ligne).toMatchObject({ Service: '', Profil: 'Client externe', Statut: 'En cours (brouillon)' })
  })
})

describe('profilEvaluateur', () => {
  it('distingue pairs, managers, cadres et clients externes', () => {
    expect(['UTILISATEUR', 'MANAGER', 'CADRE', 'EXTERNE'].map(profilEvaluateur)).toEqual([
      'Pair',
      'Manager',
      'Cadre (facultatif)',
      'Client externe',
    ])
  })
})

describe('nomFichierSuivi', () => {
  const jour = new Date('2026-11-08T10:00:00Z')

  it('reprend les filtres significatifs, sans accents ni espaces', () => {
    expect(nomFichierSuivi({ profil: 'Pairs', statut: 'EN_ATTENTE', service: "Compte d'escale" }, jour)).toBe(
      'Suivi_evaluateurs_Pairs_Non_commencee_Compte_d_escale_2026-11-08.xlsx'
    )
  })

  it('se contente de la date sans filtre', () => {
    expect(nomFichierSuivi({}, jour)).toBe('Suivi_evaluateurs_2026-11-08.xlsx')
  })
})
