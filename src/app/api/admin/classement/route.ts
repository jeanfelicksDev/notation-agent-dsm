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
  const [allNotes, allNotesClients] = await Promise.all([
    prisma.note.findMany({
      where: { campagneId: campagne.id },
      include: { critere: true },
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

    const notesCollegues = notesRecues.filter(
      (n) => n.critere.typeEvaluateur === 'COLLEGUE' || n.critere.typeEvaluateur === 'TOUS'
    )
    const notesManager = notesRecues.filter(
      (n) => n.critere.typeEvaluateur === 'MANAGER'
    )

    // 2.1 Calculer les notes des collègues internes (base 100)
    let scoreColleguesBase100 = 0
    let hasNotesCollegues = false
    if (notesCollegues.length > 0) {
      const notesParEvaluateur: Record<string, number> = {}
      const maxPtsParEvaluateur: Record<string, number> = {}
      for (const note of notesCollegues) {
        notesParEvaluateur[note.evaluateurId] =
          (notesParEvaluateur[note.evaluateurId] || 0) + note.valeur
        maxPtsParEvaluateur[note.evaluateurId] =
          (maxPtsParEvaluateur[note.evaluateurId] || 0) + (note.critere.noteMaximale || 5)
      }

      const ratios: number[] = []
      for (const evalId of Object.keys(notesParEvaluateur)) {
        const val = notesParEvaluateur[evalId]
        const max = maxPtsParEvaluateur[evalId] || 1
        ratios.push(val / max)
      }

      if (ratios.length > 0) {
        scoreColleguesBase100 = (ratios.reduce((sum, r) => sum + r, 0) / ratios.length) * 100
        hasNotesCollegues = true
      }
    }

    // 2.2 Calculer les notes des clients externes (3 critères notés sur 5 pts) (base 100)
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
        scoreClientBase100 =
          (clientRatios.reduce((sum, r) => sum + r, 0) / clientRatios.length) * 100
        hasNotesClients = true
      }
    }

    // 2.3 Pondération des 45% alloués aux notes agents :
    // - 60% pour les Clients Externes
    // - 40% pour les Collègues Internes
    let scoreComposanteAgentsBase100 = 0
    if (hasNotesCollegues && hasNotesClients) {
      scoreComposanteAgentsBase100 = scoreColleguesBase100 * 0.4 + scoreClientBase100 * 0.6
    } else if (hasNotesCollegues) {
      scoreComposanteAgentsBase100 = scoreColleguesBase100
    } else if (hasNotesClients) {
      scoreComposanteAgentsBase100 = scoreClientBase100
    }

    const poidsColleguesTotal = campagne.poidsCollegues || 45
    const scoreAgentsPondere = (scoreComposanteAgentsBase100 * poidsColleguesTotal) / 100

    // 2.4 Calculer la note Manager (55%)
    let scoreManagerBase100 = 0
    let hasNotesManager = false
    if (notesManager.length > 0) {
      const valTotal = notesManager.reduce((sum, n) => sum + n.valeur, 0)
      const maxTotal = notesManager.reduce((sum, n) => sum + (n.critere.noteMaximale || 5), 0)
      if (maxTotal > 0) {
        scoreManagerBase100 = (valTotal / maxTotal) * 100
        hasNotesManager = true
      }
    }

    const poidsManagerTotal = campagne.poidsManager || 55
    const scoreManagerPondere = (scoreManagerBase100 * poidsManagerTotal) / 100

    // 2.5 Score global final
    let scoreTotal = 0
    if (hasNotesManager && (hasNotesCollegues || hasNotesClients)) {
      scoreTotal = Math.round((scoreAgentsPondere + scoreManagerPondere) * 100) / 100
    } else if (hasNotesManager) {
      scoreTotal = Math.round(scoreManagerBase100 * 100) / 100
    } else if (hasNotesCollegues || hasNotesClients) {
      scoreTotal = Math.round(scoreComposanteAgentsBase100 * 100) / 100
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
      toutesLesCampagnes,
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
  interface RawAgentScore {
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
    .filter((m) => m.major !== null)

  const majorsDepartement = groupesDepartement
    .map((g) => ({
      departementNom: g.departementNom,
      directionNom: g.directionNom,
      major: g.major,
      totalAgents: g.scores.length,
    }))
    .filter((m) => m.major !== null)

  const majorsService = groupesService
    .map((g) => ({
      serviceNom: g.serviceNom,
      departementNom: g.departementNom,
      directionNom: g.directionNom,
      major: g.major,
      totalAgents: g.scores.length,
    }))
    .filter((m) => m.major !== null)

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
    laureats: {
      majorGlobal,
      majorsDirection,
      majorsDepartement,
      majorsService,
    },
    toutesLesCampagnes,
    groupesDirection,
    groupesDepartement,
    groupesService,
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