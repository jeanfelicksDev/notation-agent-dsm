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

    const siteScores = sites.map(site => {
      const siteUsers = campagne.scores
        .filter(s => s.utilisateur.siteId === site.id)
        .map(s => ({
          utilisateurId: s.utilisateurId,
          matricule: s.utilisateur.matricule,
          nom: s.utilisateur.nom,
          prenom: s.utilisateur.prenom,
          scoreTotal: s.scoreTotal,
          rang: s.rang || 0,
          scoreCollegues: s.scoreCollegues,
          scoreManager: s.scoreManager
        }))

      return {
        siteNom: site.nom,
        scores: siteUsers
      }
    }).filter(s => s.scores.length > 0)

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
          campagneId: campagne.id
        },
        include: { critere: true }
      })

      if (notesRecues.length === 0) continue

      const notesCollegues = notesRecues.filter(n => n.critere.typeEvaluateur === 'COLLEGUE')
      const notesManager = notesRecues.filter(n => n.critere.typeEvaluateur === 'MANAGER')

      let scoreCollegues = 0
      if (notesCollegues.length > 0) {
        const moyenneCollegues = notesCollegues.reduce((sum, n) => sum + n.valeur, 0) / notesCollegues.length
        const noteMaxCollegues = Math.max(...notesCollegues.map(n => n.critere.noteMaximale), 5)
        scoreCollegues = (moyenneCollegues / noteMaxCollegues) * campagne.poidsCollegues
      }

      let scoreManager = 0
      if (notesManager.length > 0) {
        const noteMaxManager = Math.max(...notesManager.map(n => n.critere.noteMaximale), 55)
        const sommeManager = notesManager.reduce((sum, n) => {
          const noteMax = n.critere.noteMaximale || 5
          return sum + (n.valeur / noteMax) * 55
        }, 0)
        scoreManager = Math.min(sommeManager, campagne.poidsManager)
      }

      const scoreTotal = scoreCollegues + scoreManager

      await prisma.scoreFinal.upsert({
        where: {
          utilisateurId_campagneId: {
            utilisateurId: user.id,
            campagneId: campagne.id
          }
        },
        update: { scoreCollegues, scoreManager, scoreTotal },
        create: {
          utilisateurId: user.id,
          campagneId: campagne.id,
          scoreCollegues,
          scoreManager,
          scoreTotal
        }
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