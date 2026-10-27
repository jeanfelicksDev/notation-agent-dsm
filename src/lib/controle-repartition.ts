import { compteCommeManager } from '@/lib/criteres'

/**
 * Contrôle de la répartition d'une campagne, calculé à partir des agents et des affectations déjà chargés.
 *
 * Seuls les Pairs sont contrôlés (eux seuls sont notés et classés). Une affectation invalidée
 * (force majeure) ne compte pas : ses notes sont ignorées au calcul du score.
 * - sans notant  : aucun évaluateur → pas de score ;
 * - sans noté    : le Pair n'a personne à noter ;
 * - sans manager : aucun manager hiérarchique (un manager « client interne » ne compte pas) → 0 sur le bloc manager.
 */

export type AgentControle = { id: string; nom: string; prenom: string; matricule: string; role: string; service?: string | null }
export type AffectationControle = { evaluateurId: string; evalueId: string; invalidee?: boolean; clientInterne?: boolean }

export type ResultatControle<A extends AgentControle> = {
  sansNotant: A[]
  sansNote: A[]
  sansManager: A[]
  nbPairs: number
}

const parNom = (a: AgentControle, b: AgentControle) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)

export function controlerRepartition<A extends AgentControle>(agents: A[], affectations: AffectationControle[]): ResultatControle<A> {
  const roleDe = new Map(agents.map((a) => [a.id, a.role]))
  const valides = affectations.filter((a) => !a.invalidee && a.evaluateurId !== a.evalueId)

  const ontUnNotant = new Set(valides.map((a) => a.evalueId))
  const notentQuelquun = new Set(valides.map((a) => a.evaluateurId))
  const ontUnManager = new Set(
    valides.filter((a) => compteCommeManager(roleDe.get(a.evaluateurId), a.clientInterne ?? false)).map((a) => a.evalueId)
  )

  const pairs = agents.filter((a) => a.role === 'UTILISATEUR').sort(parNom)
  return {
    sansNotant: pairs.filter((p) => !ontUnNotant.has(p.id)),
    sansNote: pairs.filter((p) => !notentQuelquun.has(p.id)),
    sansManager: pairs.filter((p) => !ontUnManager.has(p.id)),
    nbPairs: pairs.length,
  }
}

/** Regroupe des agents par service (« Sans service » en dernier), services triés par ordre alphabétique. */
export function grouperParService<A extends AgentControle>(agents: A[]): [string, A[]][] {
  const groupes = new Map<string, A[]>()
  for (const a of agents) {
    const service = a.service?.trim() || 'Sans service'
    groupes.set(service, [...(groupes.get(service) ?? []), a])
  }
  return [...groupes.entries()].sort(([s1], [s2]) =>
    s1 === 'Sans service' ? 1 : s2 === 'Sans service' ? -1 : s1.localeCompare(s2)
  )
}
