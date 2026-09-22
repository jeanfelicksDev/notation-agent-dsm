const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const CRITERES_OFFICIELS_DSM = [
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

async function seedOfficialCriteres() {
  console.log('Synchronisation des critères officiels DSM...')

  const campagnes = await prisma.campagne.findMany()
  if (campagnes.length === 0) {
    console.log("Aucune campagne trouvée. Création d'une campagne par défaut...")
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())
    const newCampagne = await prisma.campagne.create({
      data: {
        libelle: 'Évaluation Trimestrielle DSM 2026',
        dateDebut: now,
        dateFin: end,
        poidsCollegues: 45,
        poidsManager: 55,
        statut: 'OUVERTE',
      },
    })
    campagnes.push(newCampagne)
  }

  for (const c of campagnes) {
    console.log(`Mise à jour des critères pour la campagne: ${c.libelle} (${c.id})`)
    // Vider les anciens critères
    await prisma.note.deleteMany({ where: { campagne: { id: c.id } } })
    await prisma.critere.deleteMany({ where: { campagneId: c.id } })

    // Insérer les 11 critères officiels DSM
    for (const critere of CRITERES_OFFICIELS_DSM) {
      await prisma.critere.create({
        data: {
          ...critere,
          campagneId: c.id,
        },
      })
    }
  }

  console.log('✅ Synchronisation terminée avec succès ! 11 critères officiels intégrés par campagne.')
}

seedOfficialCriteres()
  .catch((e) => {
    console.error('Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
