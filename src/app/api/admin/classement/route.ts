import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

async function calculateScoresForCampagne(campagneId: string) {
  const campagne = await prisma.campagne.findUnique({
    where: { id: campagneId },
    include: {
      criteres: true,
    },
  })

  if (!campagne) return

  // 1. Récupérer toutes les notes internes et notes clients en parallèle
  // 1. Récupérer toutes les notes internes et notes clients en parallèle
  const [allNotes, allNotesClients] = await Promise.all([
    prisma.note.findMany({
      where: { campagneId: campagne.id },
      include: {
        critere: true,
        evaluateur: {
          select: { id: true, role: true, service: true },
        },
      },
    }),
    prisma.noteClient.findMany({
      where: { campagneId: campagne.id },
      include: { critere: true },
    }),
  ])

  if (allNotes.length === 0 && allNotesClients.length === 0) return

  // 2. Grouper les notes par évalué en mémoire
  const notesByEvalue = new Map<string, typeof allNotes>()
  for (const note of allNotes) {
    const list = notesByEvalue.get(note.evalueId) || []
    list.push(note)
    notesByEvalue.set(note.evalueId, list)
  }

  const clientNotesByAgent = new Map<string, typeof allNotesClients>()
  for (const nc of allNotesClients) {
    const list = clientNotesByAgent.get(nc.agentId) || []
    list.push(nc)
    clientNotesByAgent.set(nc.agentId, list)
  }

  // Obtenir tous les IDs d'agents évalués
  const evalueIds = new Set<string>([
    ...notesByEvalue.keys(),
    ...clientNotesByAgent.keys(),
  ])

  const scoresToUpsert: Array<{
    utilisateurId: string
    campagneId: string
    scoreCollegues: number
    scoreManager: number
    scoreClient: number
    scoreTotal: number
  }> = []

  for (const evalueId of evalueIds) {
    const notesRecues = notesByEvalue.get(evalueId) || []
    const clientNotes = clientNotesByAgent.get(evalueId) || []

    // 1. Notes attribuées par le/les Manager(s)
    const notesManager = notesRecues.filter((n) => {
      const isMgr = n.evaluateur?.role === 'MANAGER' || n.evaluateur?.role === 'ADMIN'
      const types = n.critere.typeEvaluateurs && n.critere.typeEvaluateurs.length > 0
        ? n.critere.typeEvaluateurs
        : [n.critere.typeEvaluateur]
      return isMgr || (types.includes('MANAGER') && !types.includes('COLLEGUE'))
    })

    // 2. Notes attribuées par les Collègues et Clients Internes (non-managers)
    const notesCollegues = notesRecues.filter((n) => {
      const isMgr = n.evaluateur?.role === 'MANAGER' || n.evaluateur?.role === 'ADMIN'
      const types = n.critere.typeEvaluateurs && n.critere.typeEvaluateurs.length > 0
        ? n.critere.typeEvaluateurs
        : [n.critere.typeEvaluateur]
      return !isMgr && (types.includes('COLLEGUE') || types.includes('CLIENT_INTERNE') || types.includes('TOUS'))
    })

    // 2.1 Calcul de la note Manager normalisée (sur base 100, destinée à peser sur 55 pts)
    let scoreManagerBase100 = 0
    let hasNotesManager = false
    if (notesManager.length > 0) {
      const notesParMgr: Record<string, number> = {}
      const maxParMgr: Record<string, number> = {}
      for (const note of notesManager) {
        notesParMgr[note.evaluateurId] = (notesParMgr[note.evaluateurId] || 0) + note.valeur
        maxParMgr[note.evaluateurId] = (maxParMgr[note.evaluateurId] || 0) + (note.critere.noteMaximale || 5)
      }

      const mgrRatios: number[] = []
      for (const id of Object.keys(notesParMgr)) {
        const val = notesParMgr[id]
        const max = maxParMgr[id] || 1
        mgrRatios.push(val / max)
      }

      if (mgrRatios.length > 0) {
        scoreManagerBase100 = (mgrRatios.reduce((sum, r) => sum + r, 0) / mgrRatios.length) * 100
        hasNotesManager = true
      }
    }

    // 2.2 Calcul des notes Collègues & Clients Internes normalisées (base 100)
    let scoreColleguesBase100 = 0
    let hasNotesCollegues = false
    if (notesCollegues.length > 0) {
      const notesParEval: Record<string, number> = {}
      const maxParEval: Record<string, number> = {}
      for (const note of notesCollegues) {
        notesParEval[note.evaluateurId] = (notesParEval[note.evaluateurId] || 0) + note.valeur
        maxParEval[note.evaluateurId] = (maxParEval[note.evaluateurId] || 0) + (note.critere.noteMaximale || 5)
      }

      const peerRatios: number[] = []
      for (const id of Object.keys(notesParEval)) {
        const val = notesParEval[id]
        const max = maxParEval[id] || 1
        peerRatios.push(val / max)
      }

      if (peerRatios.length > 0) {
        scoreColleguesBase100 = (peerRatios.reduce((sum, r) => sum + r, 0) / peerRatios.length) * 100
        hasNotesCollegues = true
      }
    }

    // 2.3 Calcul des notes Clients QR normalisées (base 100)
    let scoreClientBase100 = 0
    let hasNotesClients = false
    if (clientNotes.length > 0) {
      const notesParClient: Record<string, { val: number; max: number }> = {}
      for (const nc of clientNotes) {
        const key = nc.clientId || nc.ipHash || nc.id
        if (!notesParClient[key]) notesParClient[key] = { val: 0, max: 0 }
        notesParClient[key].val += nc.valeur
        notesParClient[key].max += (nc.critere.noteMaximale || 5)
      }

      const clientRatios = Object.values(notesParClient)
        .filter((c) => c.max > 0)
        .map((c) => c.val / c.max)

      if (clientRatios.length > 0) {
        scoreClientBase100 = (clientRatios.reduce((sum, r) => sum + r, 0) / clientRatios.length) * 100
        hasNotesClients = true
      }
    }

    // 2.4 LE TOTAL DES NOTES COLLÈGUES + CLIENT INTERNE + CLIENT QR EST SUR 45 POINTS
    // (Collègues: 20 pts, Clients QR: 25 pts)
    // ET CELUI DES MANAGERS SUR 55 POINTS, QUELQUE SOIT LE NOMBRE DE CRITÈRES SOUMIS
    let scoreNonManagerBase100 = 0
    if (hasNotesCollegues && hasNotesClients) {
      // Si l'agent a à la fois des collègues internes et des clients QR :
      // Répartition : pairs internes (20 pts) + clients QR (25 pts) = 45 points au total
      scoreNonManagerBase100 = (scoreColleguesBase100 * 20 + scoreClientBase100 * 25) / 45
    } else if (hasNotesCollegues) {
      // Uniquement des collègues / clients internes : 100% de la note attribuée sur les 45 points
      scoreNonManagerBase100 = scoreColleguesBase100
    } else if (hasNotesClients) {
      // Uniquement des clients QR : 100% de la note attribuée sur les 45 points
      scoreNonManagerBase100 = scoreClientBase100
    }

    const poidsColleguesTotal = campagne.poidsCollegues || 45
    const poidsManagerTotal = campagne.poidsManager || 55

    // Part globale Collègues + Client Interne + Client QR sur 45 points
    const partNonManagerSur45 = (scoreNonManagerBase100 * poidsColleguesTotal) / 100

    // Part globale Manager sur 55 points
    const partManagerSur55 = (scoreManagerBase100 * poidsManagerTotal) / 100

    // 2.5 Score total final sur 100 points
    let scoreTotal = 0
    if (hasNotesManager && (hasNotesCollegues || hasNotesClients)) {
      scoreTotal = Math.round((partNonManagerSur45 + partManagerSur55) * 100) / 100
    } else if (hasNotesManager) {
      scoreTotal = Math.round(scoreManagerBase100 * 100) / 100
    } else if (hasNotesCollegues || hasNotesClients) {
      scoreTotal = Math.round(scoreNonManagerBase100 * 100) / 100
    }

    scoresToUpsert.push({
      utilisateurId: evalueId,
      campagneId: campagne.id,
      scoreCollegues: Math.round(scoreColleguesBase100 * 100) / 100,
      scoreManager: Math.round(scoreManagerBase100 * 100) / 100,
      scoreClient: Math.round(scoreClientBase100 * 100) / 100,
      scoreTotal,
    })
  }

  // Trier par score décroissant pour assigner les rangs
  scoresToUpsert.sort((a, b) => b.scoreTotal - a.scoreTotal)

  // 3. Récupérer les scores existants pour comparer et éviter d'écrire inutilement
  const existingScores = await prisma.scoreFinal.findMany({
    where: { campagneId: campagne.id },
  })

  const existingMap = new Map<string, typeof existingScores[0]>()
  for (const es of existingScores) {
    existingMap.set(es.utilisateurId, es)
  }

  const changedScores = scoresToUpsert.filter((item, index) => {
    const existing = existingMap.get(item.utilisateurId)
    if (!existing) return true
    const expectedRang = index + 1
    return (
      Math.abs(existing.scoreCollegues - item.scoreCollegues) > 0.001 ||
      Math.abs(existing.scoreManager - item.scoreManager) > 0.001 ||
      Math.abs(existing.scoreClient - item.scoreClient) > 0.001 ||
      Math.abs(existing.scoreTotal - item.scoreTotal) > 0.001 ||
      existing.rang !== expectedRang
    )
  })

  // 4. Sauvegarder dans une transaction bulk seulement s'il y a des changements
  if (changedScores.length > 0) {
    await prisma.$transaction(
      changedScores.map((item) => {
        const globalIndex = scoresToUpsert.findIndex((s) => s.utilisateurId === item.utilisateurId)
        const rank = globalIndex !== -1 ? globalIndex + 1 : 1
        return prisma.scoreFinal.upsert({
          where: {
            utilisateurId_campagneId: {
              utilisateurId: item.utilisateurId,
              campagneId: item.campagneId,
            },
          },
          update: {
            scoreCollegues: item.scoreCollegues,
            scoreManager: item.scoreManager,
            scoreClient: item.scoreClient,
            scoreTotal: item.scoreTotal,
            rang: rank,
          },
          create: {
            utilisateurId: item.utilisateurId,
            campagneId: item.campagneId,
            scoreCollegues: item.scoreCollegues,
            scoreManager: item.scoreManager,
            scoreClient: item.scoreClient,
            scoreTotal: item.scoreTotal,
            rang: rank,
          },
        })
      })
    )
  }
}

export interface RawAgentScore {
  utilisateurId: string
  matricule: string
  nom: string
  prenom: string
  direction: string
  departement: string
  service: string
  siteNom: string
  scoreTotal: number
  scoreCollegues: number
  scoreManager: number
  scoreClient: number
  hasCollegues: boolean
  hasManager: boolean
  hasClient: boolean
  rangGlobal: number
  rangDirection: number
  rangDepartement: number
  rangService: number
  isMajorGlobal: boolean
  isMajorDirection: boolean
  isMajorDepartement: boolean
  isMajorService: boolean
  totalInDirection: number
  totalInDepartement: number
  totalInService: number
}

function computeRankings(rawList: RawAgentScore[]) {
  // 2. Calcul du Rang Global (sur toute la campagne)
  rawList.sort((a, b) => b.scoreTotal - a.scoreTotal || b.scoreManager - a.scoreManager || b.scoreCollegues - a.scoreCollegues)
  rawList.forEach((agent, idx) => {
    agent.rangGlobal = idx + 1
    if (agent.rangGlobal === 1) {
      agent.isMajorGlobal = true
    }
  })

  // 3. Calcul des Rangs par Direction
  const directionMap = new Map<string, RawAgentScore[]>()
  for (const agent of rawList) {
    const list = directionMap.get(agent.direction) || []
    list.push(agent)
    directionMap.set(agent.direction, list)
  }

  for (const [, agents] of directionMap.entries()) {
    agents.sort((a, b) => b.scoreTotal - a.scoreTotal || b.scoreManager - a.scoreManager || b.scoreCollegues - a.scoreCollegues)
    const count = agents.length
    agents.forEach((agent, idx) => {
      agent.rangDirection = idx + 1
      agent.totalInDirection = count
      if (agent.rangDirection === 1) {
        agent.isMajorDirection = true
      }
    })
  }

  // 4. Calcul des Rangs par Département
  const departementMap = new Map<string, RawAgentScore[]>()
  for (const agent of rawList) {
    const key = agent.departement
    const list = departementMap.get(key) || []
    list.push(agent)
    departementMap.set(key, list)
  }

  for (const [, agents] of departementMap.entries()) {
    agents.sort((a, b) => b.scoreTotal - a.scoreTotal || b.scoreManager - a.scoreManager || b.scoreCollegues - a.scoreCollegues)
    const count = agents.length
    agents.forEach((agent, idx) => {
      agent.rangDepartement = idx + 1
      agent.totalInDepartement = count
      if (agent.rangDepartement === 1) {
        agent.isMajorDepartement = true
      }
    })
  }

  // 5. Calcul des Rangs par Service / Cellule
  const serviceMap = new Map<string, RawAgentScore[]>()
  for (const agent of rawList) {
    const key = agent.service
    const list = serviceMap.get(key) || []
    list.push(agent)
    serviceMap.set(key, list)
  }

  for (const [, agents] of serviceMap.entries()) {
    agents.sort((a, b) => b.scoreTotal - a.scoreTotal || b.scoreManager - a.scoreManager || b.scoreCollegues - a.scoreCollegues)
    const count = agents.length
    agents.forEach((agent, idx) => {
      agent.rangService = idx + 1
      agent.totalInService = count
      if (agent.rangService === 1) {
        agent.isMajorService = true
      }
    })
  }

  // 6. Construire les groupes hiérarchiques triés
  const groupesDirection: Array<{
    directionNom: string
    scores: RawAgentScore[]
    major: RawAgentScore | null
  }> = []

  for (const [directionNom, scores] of directionMap.entries()) {
    groupesDirection.push({
      directionNom,
      scores,
      major: scores.length > 0 ? scores[0] : null,
    })
  }
  groupesDirection.sort((a, b) => a.directionNom.localeCompare(b.directionNom))

  const groupesDepartement: Array<{
    departementNom: string
    directionNom: string
    scores: RawAgentScore[]
    major: RawAgentScore | null
  }> = []

  for (const [departementNom, scores] of departementMap.entries()) {
    const dirNom = scores[0]?.direction || ''
    groupesDepartement.push({
      departementNom,
      directionNom: dirNom,
      scores,
      major: scores.length > 0 ? scores[0] : null,
    })
  }
  groupesDepartement.sort((a, b) => a.departementNom.localeCompare(b.departementNom))

  const groupesService: Array<{
    serviceNom: string
    departementNom: string
    directionNom: string
    scores: RawAgentScore[]
    major: RawAgentScore | null
  }> = []

  for (const [serviceNom, scores] of serviceMap.entries()) {
    const depNom = scores[0]?.departement || ''
    const dirNom = scores[0]?.direction || ''
    groupesService.push({
      serviceNom,
      departementNom: depNom,
      directionNom: dirNom,
      scores,
      major: scores.length > 0 ? scores[0] : null,
    })
  }
  groupesService.sort((a, b) => a.serviceNom.localeCompare(b.serviceNom))

  // 7. Extraire la liste des Lauréats officiels
  const majorGlobal = rawList.find((a) => a.rangGlobal === 1) || null

  const majorsDirection = groupesDirection
    .map((g) => ({
      directionNom: g.directionNom,
      major: g.major,
      totalAgents: g.scores.length,
    }))
    .filter((m): m is { directionNom: string; major: RawAgentScore; totalAgents: number } => m.major !== null)

  const majorsDepartement = groupesDepartement
    .map((g) => ({
      departementNom: g.departementNom,
      directionNom: g.directionNom,
      major: g.major,
      totalAgents: g.scores.length,
    }))
    .filter((m): m is { departementNom: string; directionNom: string; major: RawAgentScore; totalAgents: number } => m.major !== null)

  const majorsService = groupesService
    .map((g) => ({
      serviceNom: g.serviceNom,
      departementNom: g.departementNom,
      directionNom: g.directionNom,
      major: g.major,
      totalAgents: g.scores.length,
    }))
    .filter((m): m is { serviceNom: string; departementNom: string; directionNom: string; major: RawAgentScore; totalAgents: number } => m.major !== null)

  return {
    laureats: {
      majorGlobal,
      majorsDirection,
      majorsDepartement,
      majorsService,
    },
    groupesDirection,
    groupesDepartement,
    groupesService,
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getFullClassementData(targetCampagneId?: string) {
  const toutesLesCampagnes = await prisma.campagne.findMany({
    select: {
      id: true,
      libelle: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const years = new Set(toutesLesCampagnes.map((c) => new Date(c.dateDebut).getFullYear()))
  const sortedYears = Array.from(years).sort((a, b) => b - a)
  const annualCampagnes = sortedYears.map(year => ({
    id: `ANNUEL_${year}`,
    libelle: `🏆 Palmarès Annuel ${year} (Moyenne)`,
    statut: 'TERMINÉE' as any,
    dateDebut: new Date(`${year}-01-01`),
    dateFin: new Date(`${year}-12-31`),
  }))

  const allCampagnesWithAnnual = [...annualCampagnes, ...toutesLesCampagnes]

  const isAnnual = targetCampagneId?.startsWith('ANNUEL_')
  const annualYear = isAnnual && targetCampagneId ? parseInt(targetCampagneId.split('_')[1]) : null

  if (isAnnual && annualYear) {
    const campagnesOfYear = await prisma.campagne.findMany({
      where: {
        dateDebut: {
          gte: new Date(`${annualYear}-01-01`),
          lte: new Date(`${annualYear}-12-31T23:59:59.999Z`)
        }
      },
      select: { id: true }
    })

    const scoresFinales = await prisma.scoreFinal.findMany({
      where: { campagneId: { in: campagnesOfYear.map(c => c.id) } },
      include: {
        utilisateur: {
          include: { site: true }
        }
      }
    })

    const userMap = new Map<string, { scores: typeof scoresFinales, utilisateur: typeof scoresFinales[0]['utilisateur'] }>()
    for (const sf of scoresFinales) {
      if (!userMap.has(sf.utilisateurId)) {
        userMap.set(sf.utilisateurId, { scores: [], utilisateur: sf.utilisateur })
      }
      userMap.get(sf.utilisateurId)!.scores.push(sf)
    }

    const rawList: RawAgentScore[] = []
    for (const [userId, data] of userMap.entries()) {
      const s = data.utilisateur
      if (!s) continue
      if (s.role === 'MANAGER' || s.role === 'EXTERNE' || s.role === 'ADMIN') continue

      const count = data.scores.length
      const sumTotal = data.scores.reduce((acc, curr) => acc + curr.scoreTotal, 0)
      const sumCollegues = data.scores.reduce((acc, curr) => acc + curr.scoreCollegues, 0)
      const sumManager = data.scores.reduce((acc, curr) => acc + curr.scoreManager, 0)
      const sumClient = data.scores.reduce((acc, curr) => acc + curr.scoreClient, 0)

      const dir = (s.direction && s.direction.trim()) || (s.site?.nom && s.site.nom.trim()) || 'Direction DSM'
      const dep = (s.departement && s.departement.trim()) || dir || 'Département DSM'
      const srv = (s.service && s.service.trim()) || dep || 'Service DSM'
      const site = (s.site?.nom && s.site.nom.trim()) || dep || 'Siège DSM'

      rawList.push({
        utilisateurId: userId,
        matricule: s.matricule,
        nom: s.nom,
        prenom: s.prenom,
        direction: dir,
        departement: dep,
        service: srv,
        siteNom: site,
        scoreTotal: Math.round((sumTotal / count) * 10) / 10,
        scoreCollegues: Math.round((sumCollegues / count) * 10) / 10,
        scoreManager: Math.round((sumManager / count) * 10) / 10,
        scoreClient: Math.round((sumClient / count) * 10) / 10,
        hasCollegues: sumCollegues > 0,
        hasManager: sumManager > 0,
        hasClient: sumClient > 0,
        rangGlobal: 0,
        rangDirection: 0,
        rangDepartement: 0,
        rangService: 0,
        isMajorGlobal: false,
        isMajorDirection: false,
        isMajorDepartement: false,
        isMajorService: false,
        totalInDirection: 0,
        totalInDepartement: 0,
        totalInService: 0,
      })
    }

    const rankings = computeRankings(rawList)

    return {
      campagne: {
        id: `ANNUEL_${annualYear}`,
        libelle: `🏆 Palmarès Annuel ${annualYear}`,
        statut: 'TERMINÉE',
        poidsCollegues: 45,
        poidsManager: 55,
        prixGlobal: 'Super Lauréat Annuel (1 500 000 FCFA + Séjour)',
        prixDirection: 'Super Lauréat Annuel (1 500 000 FCFA + Séjour)',
        prixDepartement: 'Certificat de Mérite Annuel + Prime',
        prixService: "Diplôme d'Honneur Annuel + Prime",
      },
      toutesLesCampagnes: allCampagnesWithAnnual as any,
      laureats: rankings.laureats,
      groupesDirection: rankings.groupesDirection,
      groupesDepartement: rankings.groupesDepartement,
      groupesService: rankings.groupesService,
      tousLesScores: rawList,
    }
  }

  let campagne = null
  if (targetCampagneId) {
    campagne = await prisma.campagne.findUnique({
      where: { id: targetCampagneId },
      include: {
        scores: {
          include: {
            utilisateur: {
              include: { site: true },
            },
          },
          orderBy: { scoreTotal: 'desc' },
        },
      },
    })
  }

  // Si pas de campagne cible : Priorité absolue à la campagne en cours (OUVERTE)
  if (!campagne) {
    campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      orderBy: { createdAt: 'desc' },
      include: {
        scores: {
          include: {
            utilisateur: {
              include: { site: true },
            },
          },
          orderBy: { scoreTotal: 'desc' },
        },
      },
    })
  }

  // Si pas de campagne OUVERTE, prendre la plus récente (tous statuts confondus)
  if (!campagne) {
    campagne = await prisma.campagne.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        scores: {
          include: {
            utilisateur: {
              include: { site: true },
            },
          },
          orderBy: { scoreTotal: 'desc' },
        },
      },
    })
  }

  if (!campagne) {
    return {
      campagne: null,
      toutesLesCampagnes: allCampagnesWithAnnual as any,
      laureats: {
        majorGlobal: null,
        majorsDirection: [],
        majorsDepartement: [],
        majorsService: [],
      },
      groupesDirection: [],
      groupesDepartement: [],
      groupesService: [],
      tousLesScores: [],
    }
  }

  // Calculer/Mettre à jour les scores automatiquement
  await calculateScoresForCampagne(campagne.id)

  const updatedCampagne = await prisma.campagne.findUnique({
    where: { id: campagne.id },
    include: {
      scores: {
        include: {
          utilisateur: {
            include: { site: true },
          },
        },
        orderBy: { scoreTotal: 'desc' },
      },
    },
  })

  if (updatedCampagne) {
    campagne = updatedCampagne
  }

  // 1. Extraire et normaliser les données de tous les agents évalués


  const rawList: RawAgentScore[] = (campagne.scores || [])
    .filter((s) => s.utilisateur && s.utilisateur.role !== 'MANAGER' && s.utilisateur.role !== 'EXTERNE' && s.utilisateur.role !== 'ADMIN')
    .map((s) => {
      const dir = (s.utilisateur.direction && s.utilisateur.direction.trim()) || (s.utilisateur.site?.nom && s.utilisateur.site.nom.trim()) || 'Direction DSM'
      const dep = (s.utilisateur.departement && s.utilisateur.departement.trim()) || dir || 'Département DSM'
      const srv = (s.utilisateur.service && s.utilisateur.service.trim()) || dep || 'Service DSM'
      const site = (s.utilisateur.site?.nom && s.utilisateur.site.nom.trim()) || dep || 'Siège DSM'

      return {
        utilisateurId: s.utilisateurId,
        matricule: s.utilisateur.matricule,
        nom: s.utilisateur.nom,
        prenom: s.utilisateur.prenom,
        direction: dir,
        departement: dep,
        service: srv,
        siteNom: site,
        scoreTotal: Math.round(s.scoreTotal * 10) / 10,
        scoreCollegues: Math.round(s.scoreCollegues * 10) / 10,
        scoreManager: Math.round(s.scoreManager * 10) / 10,
        scoreClient: Math.round(s.scoreClient * 10) / 10,
        hasCollegues: s.scoreCollegues > 0,
        hasManager: s.scoreManager > 0,
        hasClient: s.scoreClient > 0,
        rangGlobal: 0,
        rangDirection: 0,
        rangDepartement: 0,
        rangService: 0,
        isMajorGlobal: false,
        isMajorDirection: false,
        isMajorDepartement: false,
        isMajorService: false,
        totalInDirection: 0,
        totalInDepartement: 0,
        totalInService: 0,
      }
    })

  const rankings = computeRankings(rawList)

  return {
    campagne: {
      id: campagne.id,
      libelle: campagne.libelle,
      statut: campagne.statut,
      poidsCollegues: campagne.poidsCollegues,
      poidsManager: campagne.poidsManager,
      prixGlobal: campagne.prixGlobal || 'Super Lauréat Direction DSM (1 500 000 FCFA + Séjour familial & Gala AGL)',
      prixDirection: campagne.prixDirection || 'Super Lauréat Direction DSM (1 500 000 FCFA + Séjour familial & Gala AGL)',
      prixDepartement: campagne.prixDepartement || 'Certificat de Mérite + Prime (1 000 000 FCFA)',
      prixService: campagne.prixService || "Diplôme d'Honneur + Prime (500 000 FCFA)",
    },
    laureats: rankings.laureats,
    toutesLesCampagnes: allCampagnesWithAnnual as any,
    groupesDirection: rankings.groupesDirection,
    groupesDepartement: rankings.groupesDepartement,
    groupesService: rankings.groupesService,
    tousLesScores: rawList,
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const campagneId = searchParams.get('campagneId') || undefined
    const data = await getFullClassementData(campagneId)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error fetching scores:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json().catch(() => null)
    let campagneId = body?.campagneId

    if (!campagneId) {
      const latest = await prisma.campagne.findFirst({ orderBy: { createdAt: 'desc' } })
      campagneId = latest?.id
    }

    if (!campagneId) {
      return NextResponse.json({ error: 'Aucune campagne trouvée' }, { status: 404 })
    }

    await calculateScoresForCampagne(campagneId)

    await prisma.campagne.update({
      where: { id: campagneId },
      data: { statut: 'CALCULEE' },
    })

    const freshData = await getFullClassementData(campagneId)

    return NextResponse.json(
      {
        success: true,
        message: 'Classement recalculé et synchronisé avec succès',
        ...freshData,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error in POST /api/admin/classement:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}