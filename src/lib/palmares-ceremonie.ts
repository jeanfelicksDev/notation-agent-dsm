import type { Distinction } from '@/lib/distinctions'

/**
 * Palmarès d'une campagne mis en forme pour la page des résultats :
 * un niveau par distinction, un lauréat par entité.
 */

/** Champs de la réponse de GET /api/admin/classement utilisés par la page des résultats. */
interface AgentClasse {
  matricule: string
  nom: string
  prenom: string
  direction: string
  departement: string
  service: string
  scoreTotal: number
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

export function versPalmares(reponse: ReponseClassement): Palmares {
  const { majorGlobal, majorsDepartement, majorsService } = reponse.laureats
  const niveaux: Record<Distinction, Laureat[]> = {
    CAPTAIN: majorGlobal
      ? [versLaureat(majorGlobal.direction, majorGlobal, `${majorGlobal.service} · ${majorGlobal.departement}`)]
      : [],
    CHIEF_OFFICER: majorsDepartement.map((d) => versLaureat(d.departementNom, d.major, d.major.service)),
    SECOND_OFFICER: majorsService.map((s) => versLaureat(s.serviceNom, s.major, s.departementNom)),
  }
  return {
    libelle: reponse.campagne?.libelle ?? '',
    provisoire: reponse.provisoire,
    niveaux,
    aucunLaureat: Object.values(niveaux).every((laureats) => laureats.length === 0),
  }
}
