const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const CRITERES_OFFICIELS_DSM = [
  // --- GRILLE COLLABORATEURS (Total = 45 points) ---
  {
    libelle: 'Communication',
    description:
      'Capacité de l’agent à transmettre les informations de manière claire, concise et compréhensible, tout en faisant preuve d’écoute active, de transparence et de courtoisie.',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Esprit d’équipe',
    description:
      'Aptitude à collaborer efficacement avec les collègues, à favoriser l’harmonie, l’entraide et la solidarité collective.',
    noteMaximale: 10,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Force de proposition',
    description:
      'Aptitude à prendre des initiatives pertinentes, à proposer des solutions constructives et des axes d’amélioration.',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Dynamisme et résilience',
    description:
      'Énergie, engagement et persévérance démontrés dans l’exécution des missions, ainsi que la capacité à rester efficace face aux difficultés.',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
  },
  {
    libelle: 'Respect et politesse envers les clients',
    description:
      'Bon comportement professionnel, langage courtois et attitude à adopter dans les relations avec les collaborateurs et les clients.',
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
      'Énergie, engagement et persévérance démontrés dans l’exécution des missions, et capacité à rechercher des solutions.',
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
      'Niveau de compétence technique et professionnelle dans l’exécution des missions, avec autonomie et fiabilité.',
    noteMaximale: 10,
    typeEvaluateur: 'MANAGER',
  },
]

async function seedOfficialCriteres() {
  console.log('Synchronisation des critères officiels DSM...')

  const campagnes = await prisma.campagne.findMany()
  if (campagnes.length === 0) {
    console.log('Aucune campagne trouvée. Création d’une campagne par défaut...')
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
    // Vider les anciens critères s'il y en avait
    await prisma.critere.deleteMany({ where: { campagneId: c.id } })

    // Insérer les 15 critères officiels DSM
    for (const critere of CRITERES_OFFICIELS_DSM) {
      await prisma.critere.create({
        data: {
          ...critere,
          campagneId: c.id,
        },
      })
    }
  }

  console.log('✅ Synchronisation terminée avec succès ! 15 critères officiels intégrés par campagne.')
}

seedOfficialCriteres()
  .catch((e) => {
    console.error('Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
