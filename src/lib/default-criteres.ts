export interface CritereOfficiel {
  libelle: string
  description: string
  noteMaximale: number
  typeEvaluateur: 'COLLEGUE' | 'MANAGER'
}

export const CRITERES_OFFICIELS_DSM: CritereOfficiel[] = [
  // --- GRILLE COLLABORATEURS (Total = 45 points) ---
  {
    libelle: 'Communication',
    description:
      'Capacité de l’agent à transmettre les informations de manière claire, concise et compréhensible, tout en faisant preuve d’écoute active, de transparence et de courtoisie dans ses échanges professionnels.',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Esprit d’équipe',
    description:
      'Aptitude à collaborer efficacement avec les collègues, à favoriser l’harmonie, l’entraide et la solidarité collective dans la résolution des problèmes et l’atteinte des objectifs communs.',
    noteMaximale: 10,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Force de proposition',
    description:
      'Aptitude à prendre des initiatives pertinentes, à proposer des solutions constructives et des axes d’amélioration contribuant à l’optimisation des performances.',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Dynamisme et résilience',
    description:
      'Énergie, engagement et persévérance démontrés dans l’exécution des missions, ainsi que la capacité à rester efficace et à rechercher des solutions face aux difficultés.',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Respect et politesse envers les clients',
    description:
      'Bon comportement professionnel, langage courtois et attitude à adopter dans les relations avec les collaborateurs et les clients (internes et externes).',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Maîtrise des tâches',
    description:
      'Niveau de compétence technique et professionnelle dans l’exécution des missions relevant des prérogatives de l’agent.',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Appréciation des clients (internes et externes)',
    description:
      'Évaluation de la satisfaction des clients à travers des sondages (qualité de l’assistance, service rendu, célérité dans le traitement des dossiers).',
    noteMaximale: 10,
    typeEvaluateur: 'COLLEGUE',
  },

  // --- GRILLE MANAGER (Total = 55 points) ---
  {
    libelle: 'Communication',
    description:
      'Capacité de l’agent à transmettre les informations de manière claire, concise et compréhensible, tout en faisant preuve d’écoute active, de transparence et de courtoisie.',
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Ponctualité',
    description:
      'Respect des horaires de travail, des heures d’embauche et des délais liés aux engagements professionnels.',
    noteMaximale: 10,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Réactivité',
    description:
      'Capacité à traiter rapidement les demandes et à exécuter les tâches confiées dans les délais prescrits, avec efficacité et sérieux.',
    noteMaximale: 10,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Force de proposition',
    description:
      'Aptitude à prendre des initiatives pertinentes, à proposer des solutions constructives et des axes d’amélioration.',
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Respect des mesures et règles',
    description:
      'Conformité aux règles, procédures, politiques internes et mesures de sécurité qui régissent l’entreprise.',
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Dynamisme et résilience',
    description:
      'Énergie, engagement et persévérance démontrés dans l’exécution des missions, et capacité à rechercher des solutions face aux difficultés.',
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Respect et politesse envers les clients',
    description:
      'Bon comportement professionnel, langage courtois et attitude à adopter dans les relations avec les collaborateurs et les clients.',
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Maîtrise des tâches',
    description:
      'Niveau de compétence technique et professionnelle dans l’exécution des missions relevant des prérogatives de l’agent, avec autonomie et fiabilité.',
    noteMaximale: 10,
    typeEvaluateur: 'MANAGER',
  },
]

export interface OptionAppreciation {
  note: number
  appreciation: string
  description: string
}

export const SCALE_10_POINTS: OptionAppreciation[] = [
  { note: 10, appreciation: 'Excellent', description: 'Performance exemplaire, dépasse les attentes.' },
  { note: 9, appreciation: 'Très satisfaisant', description: 'Travail de très grande qualité, quelques améliorations mineures.' },
  { note: 8, appreciation: 'Satisfaisant +', description: 'Résultats solides et réguliers, répond pleinement aux attentes.' },
  { note: 7, appreciation: 'Satisfaisant', description: 'Performance conforme aux attentes du poste.' },
  { note: 6, appreciation: 'Assez satisfaisant', description: 'Niveau acceptable avec quelques axes d’amélioration.' },
  { note: 5, appreciation: 'Moyen', description: 'Performance inégale nécessitant un accompagnement.' },
  { note: 4, appreciation: 'Insuffisant +', description: 'Plusieurs lacunes observées impactant les résultats.' },
  { note: 3, appreciation: 'Insuffisant', description: 'Performance en dessous des attentes.' },
  { note: 2, appreciation: 'Très insuffisant', description: 'Nombreuses difficultés nécessitant des mesures correctives rapides.' },
  { note: 1, appreciation: 'Critique', description: 'Performance très faible, objectifs non atteints.' },
]

export const SCALE_5_POINTS: OptionAppreciation[] = [
  { note: 5, appreciation: 'Excellent', description: 'Dépasse largement les attentes.' },
  { note: 4, appreciation: 'Très satisfaisant', description: 'Répond pleinement aux attentes avec une performance de qualité.' },
  { note: 3, appreciation: 'Satisfaisant', description: 'Répond globalement aux attentes du poste.' },
  { note: 2, appreciation: 'À améliorer', description: 'Plusieurs points nécessitent une amélioration.' },
  { note: 1, appreciation: 'Insuffisant', description: 'Performance en dessous des attentes, des actions correctives sont nécessaires.' },
]

export function getAppreciationOptions(noteMaximale: number): OptionAppreciation[] {
  if (noteMaximale === 10) return SCALE_10_POINTS
  return SCALE_5_POINTS
}

export function getAppreciationInfo(scoreTotalPercent: number) {
  if (scoreTotalPercent >= 90) {
    return {
      appreciation: 'Excellent',
      interpretation: 'Performance remarquable, modèle de référence',
      colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      badgeClass: 'bg-emerald-500 text-white',
    }
  } else if (scoreTotalPercent >= 75) {
    return {
      appreciation: 'Très satisfaisant',
      interpretation: 'Objectifs atteints avec constance',
      colorBadge: 'bg-blue-100 text-blue-800 border-blue-200',
      badgeClass: 'bg-blue-500 text-white',
    }
  } else if (scoreTotalPercent >= 60) {
    return {
      appreciation: 'Satisfaisant',
      interpretation: 'Performance acceptable, axes d’amélioration ciblé',
      colorBadge: 'bg-amber-100 text-amber-800 border-amber-200',
      badgeClass: 'bg-amber-500 text-white',
    }
  } else if (scoreTotalPercent >= 50) {
    return {
      appreciation: 'Insuffisant',
      interpretation: 'Résultats en deçà des attentes, plan de progrès requis',
      colorBadge: 'bg-orange-100 text-orange-800 border-orange-200',
      badgeClass: 'bg-orange-500 text-white',
    }
  } else {
    return {
      appreciation: 'Critique',
      interpretation: 'Performance non conforme, accompagnement renforcé',
      colorBadge: 'bg-red-100 text-red-800 border-red-200',
      badgeClass: 'bg-red-500 text-white',
    }
  }
}
