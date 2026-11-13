/**
 * Onglet Suivi : avancement des soumissions par service de l'évaluateur.
 * Règles pures, sans accès à la base (utilisables côté client).
 *
 * L'unité est l'évaluation, comme la modale de participation de l'accueil (mêmes chiffres) :
 * toutes les évaluations des notants internes comptent, y compris celles des cadres
 * (vote facultatif) et des notants invalidés. Une évaluation est soumise quand elle est terminée.
 * Les clients externes n'ont pas de service et restent hors du graphique.
 */
import { pourcentage, SANS_SERVICE } from '@/lib/participation'

export type EvaluateurService = {
  user: { role: string; service?: string | null }
  /** Évaluations affectées à l'évaluateur. */
  totalToEvaluate: number
  /** Parmi elles, celles qui sont terminées. */
  soumises: number
}
export type AvancementService = { service: string; total: number; soumises: number; restantes: number; taux: number }

/** Service sous lequel l'évaluateur est suivi ; null pour un client externe. */
export function cleServiceSuivi(user: EvaluateurService['user']): string | null {
  if (user.role === 'EXTERNE') return null
  return user.service?.trim() || SANS_SERVICE
}

/** L'évaluateur a-t-il au moins une évaluation non soumise ? */
export function aDesNonSoumises(e: Pick<EvaluateurService, 'totalToEvaluate' | 'soumises'>): boolean {
  return e.soumises < e.totalToEvaluate
}

/** Taux de soumission des évaluations par service, du plus avancé au moins avancé. */
export function avancementParService(evaluateurs: readonly EvaluateurService[]): AvancementService[] {
  const parService = new Map<string, { total: number; soumises: number }>()
  for (const e of evaluateurs) {
    const service = cleServiceSuivi(e.user)
    if (service === null) continue
    const courant = parService.get(service) ?? { total: 0, soumises: 0 }
    parService.set(service, { total: courant.total + e.totalToEvaluate, soumises: courant.soumises + e.soumises })
  }
  return [...parService]
    .map(([service, c]) => ({ service, ...c, restantes: c.total - c.soumises, taux: pourcentage(c.soumises, c.total) }))
    .sort((x, y) => y.taux - x.taux || y.total - x.total || x.service.localeCompare(y.service, 'fr'))
}
