/**
 * Export Excel du suivi « par évaluateur » : une ligne par évaluateur de la liste affichée,
 * dans le même ordre, avec les filtres déjà appliqués par l'écran.
 */
import { estCadre } from '@/lib/roles'

export type EvaluateurSuivi = {
  user: { matricule: string; nom: string; prenom: string; role: string; service?: string | null }
  statut: string
  totalToEvaluate: number
  termineeAt: string | null
}

export type LigneExportSuivi = {
  Matricule: string
  Nom: string
  Prénoms: string
  Service: string
  Profil: string
  Statut: string
  'Évaluations à faire': number
  'Soumis le': string
}

const LIBELLES_STATUT: Record<string, string> = {
  TERMINEE: 'Terminée',
  BROUILLON: 'En cours (brouillon)',
  EN_ATTENTE: 'Non commencée',
  INVALIDEE: 'Invalidé',
  // Filtre seulement (en cours + non commencé), jamais le statut d'un évaluateur
  NON_SOUMIS: 'Non soumis',
}

export function profilEvaluateur(role: string): string {
  if (role === 'MANAGER') return 'Manager'
  if (role === 'EXTERNE') return 'Client externe'
  if (estCadre(role)) return 'Cadre (facultatif)'
  return 'Pair'
}

/** JJ/MM/AAAA HH:MM, lu en UTC (heure légale d'Abidjan). */
function formatDateHeure(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${deux(d.getUTCDate())}/${deux(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}`
}

export function lignesExportSuivi(liste: readonly EvaluateurSuivi[]): LigneExportSuivi[] {
  return liste.map(({ user, statut, totalToEvaluate, termineeAt }) => ({
    Matricule: user.matricule,
    Nom: user.nom,
    Prénoms: user.prenom,
    Service: user.service ?? '',
    Profil: profilEvaluateur(user.role),
    Statut: LIBELLES_STATUT[statut] ?? statut,
    'Évaluations à faire': totalToEvaluate,
    'Soumis le': statut === 'TERMINEE' ? formatDateHeure(termineeAt) : '',
  }))
}

/** Nom du fichier : suivi, filtres significatifs, date du jour (AAAA-MM-JJ). */
export function nomFichierSuivi(filtres: { statut?: string; service?: string; profil?: string }, aujourdhui = new Date()): string {
  const morceaux = [filtres.profil, filtres.statut && (LIBELLES_STATUT[filtres.statut] ?? filtres.statut), filtres.service]
    .filter((m): m is string => !!m)
    .map((m) => m.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''))
    .filter(Boolean)
  return ['Suivi_evaluateurs', ...morceaux, aujourdhui.toISOString().slice(0, 10)].join('_') + '.xlsx'
}
