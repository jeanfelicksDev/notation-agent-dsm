import { comparerScores } from '@/lib/calcul-scores'
import type { Distinction } from '@/lib/distinctions'

/**
 * Palmarès d'une campagne mis en forme pour la page des résultats :
 * un niveau par distinction, un lauréat par entité, rangés par ordre de mérite.
 */

/** Champs du classement (src/lib/classement.ts) utilisés par la page des résultats. */
interface AgentClasse {
  matricule: string
  nom: string
  prenom: string
  direction: string
  departement: string
  service: string
  scoreTotal: number
  scoreManager: number
  scoreCollegues: number
}

export interface ReponseClassement {
  campagne: { id: string; libelle: string } | null
  provisoire: boolean
  laureats: {
    majorGlobal: AgentClasse | null
    majorsDepartement: { departementNom: string; major: AgentClasse }[]
    majorsService: { serviceNom: string; departementNom: string; major: AgentClasse }[]
  }
}

export interface Laureat {
  /** Identifiant stable dans son niveau : le nom de l'entité récompensée. */
  cle: string
  /** Direction, département ou service dont l'agent est le premier. */
  entite: string
  nomComplet: string
  /** Rattachement de l'agent, pour le situer. */
  precision: string
  scoreTotal: number
}

export interface Palmares {
  libelle: string
  /** Campagne encore ouverte ou sans calcul enregistré : les résultats peuvent changer. */
  provisoire: boolean
  niveaux: Record<Distinction, Laureat[]>
  aucunLaureat: boolean
}

function versLaureat(entite: string, agent: AgentClasse, precision: string): Laureat {
  return {
    cle: entite,
    entite,
    nomComplet: `${agent.prenom} ${agent.nom}`.trim(),
    precision,
    scoreTotal: agent.scoreTotal,
  }
}

/**
 * Nom officiel des directions, tel qu'il s'affiche sur la page des résultats.
 * La base garde son libellé d'origine : seul l'affichage de cette page est corrigé.
 */
const NOMS_OFFICIELS_DES_DIRECTIONS: Readonly<Record<string, string>> = {
  'DIRECTION SOLUTION MARITIME': 'DIRECTION DES SOLUTIONS MARITIMES',
}

/** Carte du Captain : la clé reste le libellé enregistré, l'affichage prend le nom officiel. */
function versCaptain(agent: AgentClasse): Laureat {
  const laureat = versLaureat(agent.direction, agent, `${agent.service} · ${agent.departement}`)
  return { ...laureat, entite: NOMS_OFFICIELS_DES_DIRECTIONS[agent.direction] ?? agent.direction }
}

/** Du plus méritant au moins méritant, dans l'ordre du classement (total, part manager, part collègues). */
function parMerite<T extends { major: AgentClasse }>(laureats: readonly T[]): T[] {
  return [...laureats].sort((a, b) => comparerScores(a.major, b.major))
}

export function versPalmares(reponse: ReponseClassement): Palmares {
  const { majorGlobal, majorsDepartement, majorsService } = reponse.laureats
  const niveaux: Record<Distinction, Laureat[]> = {
    CAPTAIN: majorGlobal ? [versCaptain(majorGlobal)] : [],
    CHIEF_OFFICER: parMerite(majorsDepartement).map((d) => versLaureat(d.departementNom, d.major, d.major.service)),
    SECOND_OFFICER: parMerite(majorsService).map((s) => versLaureat(s.serviceNom, s.major, s.departementNom)),
  }
  return {
    libelle: reponse.campagne?.libelle ?? '',
    provisoire: reponse.provisoire,
    niveaux,
    aucunLaureat: Object.values(niveaux).every((laureats) => laureats.length === 0),
  }
}
