/**
 * Participation d'une campagne — règles pures, sans accès à la base.
 *
 * Le taux de soumission rapporte les affectations soumises (statut TERMINEE) à toutes les
 * affectations du périmètre : pairs et clients internes (notants du personnel) d'un côté,
 * clients externes (rôle EXTERNE) de l'autre.
 */

export type AffectationParticipation = {
  evaluateurId: string
  statut: string
  termineeAt: Date | null
  service: string | null
}

export type TauxService = { service: string; total: number; soumises: number; taux: number }

/** Un point par jour : notants ayant soumis ce jour-là, et taux cumulé à la fin du jour. */
export type PointJour = { jour: string; notants: number; soumises: number; taux: number }

export const SANS_SERVICE = 'Sans service'
const JOUR_MS = 86_400_000

/** Pourcentage arrondi ; 0 quand rien n'est attendu. */
export function pourcentage(soumises: number, total: number): number {
  return total > 0 ? Math.round((soumises / total) * 100) : 0
}

/** Clé du jour (AAAA-MM-JJ). Les dates sont lues en UTC, l'heure légale d'Abidjan. */
export function cleJour(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const estSoumise = (a: Pick<AffectationParticipation, 'statut'>) => a.statut === 'TERMINEE'

/** Taux de soumission par service du notant, du plus avancé au moins avancé. */
export function tauxParService(affectations: readonly AffectationParticipation[]): TauxService[] {
  const parService = new Map<string, { total: number; soumises: number }>()
  for (const a of affectations) {
    const service = a.service?.trim() || SANS_SERVICE
    const courant = parService.get(service) ?? { total: 0, soumises: 0 }
    parService.set(service, { total: courant.total + 1, soumises: courant.soumises + (estSoumise(a) ? 1 : 0) })
  }
  return [...parService.entries()]
    .map(([service, c]) => ({ service, ...c, taux: pourcentage(c.soumises, c.total) }))
    .sort((x, y) => y.taux - x.taux || y.total - x.total || x.service.localeCompare(y.service, 'fr'))
}

/**
 * Série jour par jour, du premier jour de la campagne à aujourd'hui (au plus tard sa clôture).
 * Une soumission sans date (antérieure à l'horodatage) n'apparaît pas sur la courbe.
 */
export function courbeQuotidienne(
  affectations: readonly AffectationParticipation[],
  periode: { debut: Date; fin: Date },
  maintenant = new Date()
): PointJour[] {
  const total = affectations.length
  const notantsParJour = new Map<string, Set<string>>()
  const soumisesParJour = new Map<string, number>()
  for (const a of affectations) {
    if (!estSoumise(a) || !a.termineeAt) continue
    const jour = cleJour(a.termineeAt)
    notantsParJour.set(jour, (notantsParJour.get(jour) ?? new Set()).add(a.evaluateurId))
    soumisesParJour.set(jour, (soumisesParJour.get(jour) ?? 0) + 1)
  }

  const premier = Date.parse(cleJour(periode.debut))
  const dernier = Date.parse(cleJour(new Date(Math.min(periode.fin.getTime(), maintenant.getTime()))))
  const points: PointJour[] = []
  let cumul = 0
  for (let t = premier; t <= dernier; t += JOUR_MS) {
    const jour = cleJour(new Date(t))
    const soumises = soumisesParJour.get(jour) ?? 0
    cumul += soumises
    points.push({ jour, notants: notantsParJour.get(jour)?.size ?? 0, soumises, taux: pourcentage(cumul, total) })
  }
  return points
}
