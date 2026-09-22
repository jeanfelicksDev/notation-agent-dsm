export interface CritereOfficiel {
  libelle: string
  description: string
  noteMaximale: number
  typeEvaluateur: 'COLLEGUE' | 'MANAGER' | 'TOUS' | 'CLIENT'
}

export const CRITERES_CLIENTS_DSM: CritereOfficiel[] = [
  {
    libelle: "La qualité de l’assistance",
    description: "Évalue la qualité de l'accueil, de l'écoute, de la bienveillance et de l'accompagnement personnalisé apporté au client.",
    noteMaximale: 5,
    typeEvaluateur: 'CLIENT',
  },
  {
    libelle: "Le service rendu",
    description: "Évalue la conformité, la rigueur, la compétence et la satisfaction globale de la prestation délivrée.",
    noteMaximale: 5,
    typeEvaluateur: 'CLIENT',
  },
  {
    libelle: "La célérité dans le traitement des dossiers",
    description: "Évalue la rapidité de prise en charge, la promptitude et le respect des délais dans le traitement des opérations.",
    noteMaximale: 5,
    typeEvaluateur: 'CLIENT',
  },
]

export const CRITERES_OFFICIELS_DSM: CritereOfficiel[] = [
  // --- CRITÈRES COMMUNS (Évalués par TOUS : Collègues & Manager sur 5 pts) ---
  {
    libelle: 'Communication',
    description: "La capacité du collaborateur à transmettre et à recevoir des informations de manière claire, précise et compréhensible, que ce soit à l'écrit ou à l'oral. Cela inclut l'écoute active, la transparence, et l'aptitude à adapter son discours en fonction de son interlocuteur.",
    noteMaximale: 5,
    typeEvaluateur: 'TOUS',
  },
  {
    libelle: 'Force de proposition',
    description: "L'attitude proactive du collaborateur lorsqu'il ne se contente pas d'exécuter les tâches demandées, mais prend l'initiative de suggérer de nouvelles idées, des axes d'amélioration ou des solutions concrètes face à un problème donné.",
    noteMaximale: 5,
    typeEvaluateur: 'TOUS',
  },
  {
    libelle: 'Dynamisme',
    description: "L'énergie, l'enthousiasme et la motivation démontrés par le collaborateur au quotidien. Cela évalue son implication active dans ses missions, sa capacité à maintenir une cadence de travail soutenue et à aborder les défis avec un état d'esprit positif.",
    noteMaximale: 5,
    typeEvaluateur: 'TOUS',
  },
  {
    libelle: 'Respect et politesse',
    description: "Le maintien, par le collaborateur, d'un comportement courtois, professionnel et bienveillant envers l'ensemble de ses interlocuteurs (collègues, hiérarchie, clients). Cela implique de faire preuve de savoir-vivre, y compris lors de situations tendues ou de désaccords.",
    noteMaximale: 5,
    typeEvaluateur: 'TOUS',
  },

  // --- CRITÈRES SPÉCIFIQUES MANAGER (sur 5 pts) ---
  {
    libelle: 'Ponctualité',
    description: "La capacité du collaborateur à respecter strictement les horaires établis. Cela concerne son heure d'arrivée au travail, sa présence à l'heure aux réunions et son respect des délais fixés pour la restitution des livrables. C'est un indicateur de sa fiabilité.",
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Réactivité',
    description: "La promptitude avec laquelle le collaborateur répond à une sollicitation, un imprévu ou une urgence. Ce critère évalue sa capacité à prendre en charge rapidement une situation et à agir sans délai inutile.",
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Respect des règles',
    description: "L'adhésion et la conformité du collaborateur aux procédures internes, aux politiques de l'entreprise, au règlement intérieur ainsi qu'aux normes de sécurité en vigueur au sein de l'organisation.",
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },
  {
    libelle: 'Maîtrise des tâches',
    description: "Le niveau d'expertise technique et d'autonomie du collaborateur dans l'exécution des missions qui lui sont confiées. Ce critère permet d'évaluer s'il mobilise les compétences requises pour réaliser son travail avec précision, qualité et efficacité.",
    noteMaximale: 5,
    typeEvaluateur: 'MANAGER',
  },

  // --- CRITÈRES SPÉCIFIQUES COLLÈGUES (sur 5 pts) ---
  {
    libelle: "Esprit d'équipe",
    description: "La capacité et la volonté du collaborateur à travailler de façon constructive avec les autres membres de son groupe. Cela inclut sa disposition à l'entraide, au partage d'informations et à faire primer la réussite collective sur son intérêt strictement individuel.",
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Appréciation clients',
    description: "Le niveau de satisfaction globale généré par le collaborateur auprès des clients (qu'ils soient externes ou internes à l'entreprise). Ce critère reflète la qualité de son service, la posture qu'il adopte et sa capacité à répondre efficacement à leurs attentes.",
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Maîtrise des tâches',
    description: "Le niveau d'expertise technique et d'autonomie du collaborateur dans l'exécution des missions qui lui sont confiées. Ce critère permet d'évaluer s'il mobilise les compétences requises pour réaliser son travail avec précision, qualité et efficacité.",
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },

  // --- CRITÈRES CLIENTS EXTERNES (3 critères notés sur 5 pts chacun) ---
  ...CRITERES_CLIENTS_DSM,
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
  { note: 6, appreciation: 'Assez satisfaisant', description: "Niveau acceptable avec quelques axes d'amélioration." },
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
  { note: 2, appreciation: 'À améliorer', description: "Plusieurs points nécessitent une amélioration." },
  { note: 1, appreciation: 'Insuffisant', description: "Performance en dessous des attentes, des actions correctives sont nécessaires." },
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
      interpretation: "Performance acceptable, axes d'amélioration ciblé",
      colorBadge: 'bg-amber-100 text-amber-800 border-amber-200',
      badgeClass: 'bg-amber-500 text-white',
    }
  } else if (scoreTotalPercent >= 50) {
    return {
      appreciation: 'Insuffisant',
      interpretation: "Résultats en deçà des attentes, plan de progrès requis",
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
