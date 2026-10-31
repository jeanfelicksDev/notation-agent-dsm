/**
 * Répartition par service, calculée à partir des agents (sans accès à la base).
 *
 * Chaque manager note tous les Pairs de son service : seuls les Pairs sont notés (ni managers,
 * ni cadres, ni non-éligibles, ni clients externes). Les services sont rapprochés sans tenir
 * compte des espaces superflus. Un manager sans service ne reçoit personne.
 */

export type AgentService = { id: string; role: string; service: string | null }
export type Paire = { evaluateurId: string; evalueId: string }

const serviceDe = (a: AgentService) => a.service?.trim() ?? ''

export function pairesManagersDuService(agents: AgentService[]): { paires: Paire[]; managersSansService: number } {
  const managers = agents.filter((a) => a.role === 'MANAGER')
  const pairs = agents.filter((a) => a.role === 'UTILISATEUR' && serviceDe(a))

  const paires = managers.flatMap((m) =>
    pairs.filter((p) => serviceDe(m) && serviceDe(p) === serviceDe(m)).map((p) => ({ evaluateurId: m.id, evalueId: p.id }))
  )
  return { paires, managersSansService: managers.filter((m) => !serviceDe(m)).length }
}
