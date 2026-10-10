const fs = require('fs')

let code = fs.readFileSync('src/app/api/admin/classement/route.ts', 'utf8')

// 1. Move RawAgentScore outside
const interfaceRawAgentScore = `
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
`
code = code.replace(/  interface RawAgentScore \{[\s\S]*?totalInService: number\n  \}/, '')
code = code.replace('export const dynamic', interfaceRawAgentScore + '\nexport const dynamic')


// 2. Extract computeRankings
const computeRankingsCode = `
function computeRankings(rawList: RawAgentScore[]) {
  // 2. Calcul du Rang Global
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
  const groupesDirection: Array<{ directionNom: string; scores: RawAgentScore[]; major: RawAgentScore | null }> = []
  for (const [directionNom, scores] of directionMap.entries()) {
    groupesDirection.push({ directionNom, scores, major: scores.length > 0 ? scores[0] : null })
  }
  groupesDirection.sort((a, b) => a.directionNom.localeCompare(b.directionNom))

  const groupesDepartement: Array<{ departementNom: string; directionNom: string; scores: RawAgentScore[]; major: RawAgentScore | null }> = []
  for (const [departementNom, scores] of departementMap.entries()) {
    const dirNom = scores[0]?.direction || ''
    groupesDepartement.push({ departementNom, directionNom: dirNom, scores, major: scores.length > 0 ? scores[0] : null })
  }
  groupesDepartement.sort((a, b) => a.departementNom.localeCompare(b.departementNom))

  const groupesService: Array<{ serviceNom: string; departementNom: string; directionNom: string; scores: RawAgentScore[]; major: RawAgentScore | null }> = []
  for (const [serviceNom, scores] of serviceMap.entries()) {
    const depNom = scores[0]?.departement || ''
    const dirNom = scores[0]?.direction || ''
    groupesService.push({ serviceNom, departementNom: depNom, directionNom: dirNom, scores, major: scores.length > 0 ? scores[0] : null })
  }
  groupesService.sort((a, b) => a.serviceNom.localeCompare(b.serviceNom))

  // 7. Extraire la liste des Lauréats officiels
  const majorGlobal = rawList.find((a) => a.rangGlobal === 1) || null

  const majorsDirection = groupesDirection
    .map((g) => ({ directionNom: g.directionNom, major: g.major, totalAgents: g.scores.length }))
    .filter((m) => m.major !== null) as Array<{ directionNom: string; major: RawAgentScore; totalAgents: number }>

  const majorsDepartement = groupesDepartement
    .map((g) => ({ departementNom: g.departementNom, directionNom: g.directionNom, major: g.major, totalAgents: g.scores.length }))
    .filter((m) => m.major !== null) as Array<{ departementNom: string; directionNom: string; major: RawAgentScore; totalAgents: number }>

  const majorsService = groupesService
    .map((g) => ({ serviceNom: g.serviceNom, departementNom: g.departementNom, directionNom: g.directionNom, major: g.major, totalAgents: g.scores.length }))
    .filter((m) => m.major !== null) as Array<{ serviceNom: string; departementNom: string; directionNom: string; major: RawAgentScore; totalAgents: number }>

  return {
    laureats: { majorGlobal, majorsDirection, majorsDepartement, majorsService },
    groupesDirection,
    groupesDepartement,
    groupesService
  }
}
`

// Replace the ranking block in getFullClassementData with computeRankings call FIRST
const rankBlockRegex = /\/\/ 2\. Calcul du Rang Global[\s\S]*?const majorsService = groupesService\n[\s\S]*?\.filter\(\(m\) => m\.major !== null\)/;
code = code.replace(rankBlockRegex, 'const rankings = computeRankings(rawList)')

// Update the return statement of getFullClassementData to use rankings
code = code.replace(/laureats: \{\s*majorGlobal,\s*majorsDirection,\s*majorsDepartement,\s*majorsService,\s*\},/g, 'laureats: rankings.laureats,')
code = code.replace(/groupesDirection,\s*groupesDepartement,\s*groupesService,/g, 'groupesDirection: rankings.groupesDirection,\n    groupesDepartement: rankings.groupesDepartement,\n    groupesService: rankings.groupesService,')

// NOW add the computeRankingsCode
code = code.replace('export const dynamic', computeRankingsCode + '\nexport const dynamic')


// 4. Update the logic to inject annual campaigns and handle them
const annualLogic = `
  const years = new Set(toutesLesCampagnes.map((c) => new Date(c.dateDebut).getFullYear()))
  const sortedYears = Array.from(years).sort((a, b) => b - a)
  const annualCampagnes = sortedYears.map(year => ({
    id: \`ANNUEL_\${year}\`,
    libelle: \`🏆 Palmarès Annuel \${year} (Moyenne)\`,
    statut: 'TERMINÉE',
    dateDebut: new Date(\`\${year}-01-01\`),
    dateFin: new Date(\`\${year}-12-31\`),
  }))

  const allCampagnesWithAnnual = [...annualCampagnes, ...toutesLesCampagnes]

  const isAnnual = targetCampagneId?.startsWith('ANNUEL_')
  const annualYear = isAnnual ? parseInt(targetCampagneId.split('_')[1]) : null

  if (isAnnual && annualYear) {
    const campagnesOfYear = await prisma.campagne.findMany({
      where: {
        dateDebut: {
          gte: new Date(\`\${annualYear}-01-01\`),
          lte: new Date(\`\${annualYear}-12-31T23:59:59.999Z\`)
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
        id: \`ANNUEL_\${annualYear}\`,
        libelle: \`🏆 Palmarès Annuel \${annualYear} (Moyenne)\`,
        statut: 'TERMINÉE',
        poidsCollegues: 45,
        poidsManager: 55,
        prixGlobal: 'Dotation Annuelle Spéciale',
        prixDirection: 'Dotation Annuelle Spéciale',
        prixDepartement: "Tableau d'honneur + Prime Annuelle",
        prixService: "Tableau d'honneur Annuel",
      },
      toutesLesCampagnes: allCampagnesWithAnnual as any,
      laureats: rankings.laureats,
      groupesDirection: rankings.groupesDirection,
      groupesDepartement: rankings.groupesDepartement,
      groupesService: rankings.groupesService,
      tousLesScores: rawList,
    }
  }

`

code = code.replace('let campagne = null', annualLogic + '\n  let campagne = null')

// Replace `toutesLesCampagnes` in the final return to `toutesLesCampagnes: allCampagnesWithAnnual`
code = code.replace(/toutesLesCampagnes,(\s*groupesDirection)/g, 'toutesLesCampagnes: allCampagnesWithAnnual as any,$1')
code = code.replace(/toutesLesCampagnes\n/g, 'toutesLesCampagnes: allCampagnesWithAnnual as any,\n')

fs.writeFileSync('src/app/api/admin/classement/route.ts', code)
