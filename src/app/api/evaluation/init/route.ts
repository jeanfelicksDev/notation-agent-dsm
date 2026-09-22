import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Session expirée' }, { status: 401 })
    }

    const [evaluateur, campagne] = await Promise.all([
      prisma.utilisateur.findUnique({
        where: { id: sessionUser.id },
        include: { site: true },
      }),
      prisma.campagne.findFirst({
        where: { statut: 'OUVERTE' },
        include: { criteres: true },
      })
    ])

    if (!evaluateur) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    }

    if (evaluateur.role === 'EXTERNE') {
      return NextResponse.json({ redirect: '/qr' }, { status: 200 })
    }

    if (!campagne) {
      // Seul l'administrateur est renvoyé vers l'espace admin ; les autres rôles restent sur la notation
      if (evaluateur.role === 'ADMIN') {
        return NextResponse.json(
          { redirect: '/admin', evaluateur, error: "Aucune campagne d'évaluation ouverte." },
          { status: 200 }
        )
      }
      return NextResponse.json(
        { error: "Aucune campagne d'évaluation ouverte" },
        { status: 404 }
      )
    }

    let [affectations, notes] = await Promise.all([
      prisma.affectation.findMany({
        where: {
          evaluateurId: evaluateur.id,
          campagneId: campagne.id,
          evalueId: { not: evaluateur.id },
        },
        include: {
          evalue: { include: { site: true } },
        },
      }),
      prisma.note.findMany({
        where: {
          evaluateurId: evaluateur.id,
          campagneId: campagne.id,
          evalueId: { not: evaluateur.id },
        },
      })
    ])

    // On-the-fly auto-assignment if no affectations exist for this evaluator
    if (affectations.length === 0) {
      const allUsers = await prisma.utilisateur.findMany({
        where: {
          id: { not: evaluateur.id },
          role: 'UTILISATEUR'
        }
      })

      if (allUsers.length > 0) {
        let targets: typeof allUsers = []

        if (evaluateur.service) {
          const servicePeers = allUsers.filter(u => u.service === evaluateur.service)
          targets.push(...servicePeers)
        }

        if (targets.length === 0 && evaluateur.siteId) {
          const sitePeers = allUsers.filter(u => u.siteId === evaluateur.siteId)
          targets.push(...sitePeers)
        }

        if (targets.length === 0) {
          targets = allUsers.slice(0, 10)
        }

        const uniqueTargetIds = Array.from(new Set(targets.map(t => t.id))).filter(id => id !== evaluateur.id)

        if (uniqueTargetIds.length > 0) {
          await prisma.affectation.createMany({
            data: uniqueTargetIds.map(evalueId => ({
              campagneId: campagne.id,
              evaluateurId: evaluateur.id,
              evalueId,
            })),
            skipDuplicates: true
          })

          const refreshed = await Promise.all([
            prisma.affectation.findMany({
              where: {
                evaluateurId: evaluateur.id,
                campagneId: campagne.id,
                evalueId: { not: evaluateur.id },
              },
              include: {
                evalue: { include: { site: true } },
              },
            }),
            prisma.note.findMany({
              where: {
                evaluateurId: evaluateur.id,
                campagneId: campagne.id,
                evalueId: { not: evaluateur.id },
              },
            })
          ])
          affectations = refreshed[0]
          notes = refreshed[1]
        }
      }
    }

    if (affectations.length === 0) {
      // Seul l'administrateur est renvoyé vers l'espace admin ; les autres rôles restent sur la notation
      if (evaluateur.role === 'ADMIN') {
        return NextResponse.json(
          { redirect: '/admin', evaluateur, error: 'Aucune affectation trouvée.' },
          { status: 200 }
        )
      }
      return NextResponse.json(
        { error: 'Aucune affectation trouvée pour votre compte. Veuillez contacter l\'administrateur.' },
        { status: 404 }
      )
    }

    const isManager = evaluateur.role === 'MANAGER' || evaluateur.role === 'ADMIN'

    const filteredCriteres = campagne.criteres.filter(
      (c: { typeEvaluateur: string }) =>
        c.typeEvaluateur === 'TOUS' ||
        (isManager && c.typeEvaluateur === 'MANAGER') ||
        (!isManager && c.typeEvaluateur === 'COLLEGUE')
    )

    return NextResponse.json({
      evaluateur,
      campagne: {
        id: campagne.id,
        libelle: campagne.libelle,
        poidsCollegues: campagne.poidsCollegues,
        poidsManager: campagne.poidsManager,
      },
      criteres: filteredCriteres,
      affectations,
      notes,
      isManager,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
