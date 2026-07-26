import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'CALCULEE' },
      include: {
        scores: {
          include: {
            utilisateur: {
              include: { site: true }
            }
          },
          orderBy: { rang: 'asc' }
        }
      }
    })

    if (!campagne) {
      return NextResponse.json([])
    }

    const sites = await prisma.site.findMany()

    const siteScores: Array<{
      siteNom: string
      scores: Array<{
        utilisateurId: string; matricule: string; nom: string; prenom: string
        scoreTotal: number; rang: number; scoreCollegues: number; scoreManager: number
      }>
    }> = []
    for (const site of sites) {
      const siteUsers: Array<{
        utilisateurId: string; matricule: string; nom: string; prenom: string
        scoreTotal: number; rang: number; scoreCollegues: number; scoreManager: number
      }> = []
      for (const s of campagne.scores) {
        if (s.utilisateur.siteId === site.id) {
          siteUsers.push({
            utilisateurId: s.utilisateurId,
            matricule: s.utilisateur.matricule,
            nom: s.utilisateur.nom,
            prenom: s.utilisateur.prenom,
            scoreTotal: s.scoreTotal,
            rang: s.rang || 0,
            scoreCollegues: s.scoreCollegues,
            scoreManager: s.scoreManager
          })
        }
      }
      if (siteUsers.length > 0) {
        siteScores.push({ siteNom: site.nom, scores: siteUsers })
      }
    }

    return NextResponse.json(siteScores)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { campagneId } = await request.json()

    const campagne = await prisma.campagne.findUnique({
      where: { id: campagneId },
      include: {
        criteres: true,
        affectations: true
      }
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Campagne non trouvée' }, { status: 404 })
    }

    const users = await prisma.utilisateur.findMany({
      include: { site: true }
    })

    for (const user of users) {
      const notesRecues = await prisma.note.findMany({
        where: {
          evalueId: user.id,
          campagneId: campagne.id,
        },
        include: { critere: true },
      })

      if (notesRecues.length === 0) continue

      // Notes des collègues
      const notesCollegues = notesRecues.filter((n) => n.critere.typeEvaluateur === 'COLLEGUE')
      // Notes du manager
      const notesManager = notesRecues.filter((n) => n.critere.typeEvaluateur === 'MANAGER')

      let scoreCollegues = 0
      if (notesCollegues.length > 0) {
        // Regrouper par évaluateur (chaque collègue attribue des notes sur 45 pts au total)
        const notesParEvaluateur: Record<string, number> = {}
        for (const note of notesCollegues) {
          notesParEvaluateur[note.evaluateurId] =
            (notesParEvaluateur[note.evaluateurId] || 0) + note.valeur
        }

        const totalsCollegues = Object.values(notesParEvaluateur)
        if (totalsCollegues.length > 0) {
          const moyenneTotaux =
            totalsCollegues.reduce((sum, val) => sum + val, 0) / totalsCollegues.length
          // Ajustement si le poids configuré diffère de 45
          const maxPointsCollegues = 45
          scoreCollegues = (moyenneTotaux / maxPointsCollegues) * campagne.poidsCollegues
        }
      }

      let scoreManager = 0
      if (notesManager.length > 0) {
        const sommeNotesManager = notesManager.reduce((sum, n) => sum + n.valeur, 0)
        const maxPointsManager = 55
        scoreManager = (sommeNotesManager / maxPointsManager) * campagne.poidsManager
      }

      const scoreTotal = scoreCollegues + scoreManager

      await prisma.scoreFinal.upsert({
        where: {
          utilisateurId_campagneId: {
            utilisateurId: user.id,
            campagneId: campagne.id,
          },
        },
        update: { scoreCollegues, scoreManager, scoreTotal },
        create: {
          utilisateurId: user.id,
          campagneId: campagne.id,
          scoreCollegues,
          scoreManager,
          scoreTotal,
        },
      })
    }

    const scores = await prisma.scoreFinal.findMany({
      where: { campagneId: campagne.id },
      orderBy: { scoreTotal: 'desc' }
    })

    for (let i = 0; i < scores.length; i++) {
      await prisma.scoreFinal.update({
        where: { id: scores[i].id },
        data: { rang: i + 1 }
      })
    }

    await prisma.campagne.update({
      where: { id: campagne.id },
      data: { statut: 'CALCULEE' }
    })

    return NextResponse.json({ success: true, message: 'Classement calculé avec succès' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}