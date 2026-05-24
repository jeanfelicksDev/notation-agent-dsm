import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Session expirée' }, { status: 401 })
    }

    const evaluateur = await prisma.utilisateur.findUnique({
      where: { id: sessionUser.id },
      include: { site: true },
    })

    if (!evaluateur) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    }

    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      include: { criteres: true },
    })

    if (!campagne) {
      return NextResponse.json(
        { error: "Aucune campagne d'évaluation ouverte" },
        { status: 404 }
      )
    }

    const affectations = await prisma.affectation.findMany({
      where: {
        evaluateurId: evaluateur.id,
        campagneId: campagne.id,
      },
      include: {
        evalue: { include: { site: true } },
      },
    })

    const notes = await prisma.note.findMany({
      where: {
        evaluateurId: evaluateur.id,
        campagneId: campagne.id,
      },
    })

    if (affectations.length === 0) {
      return NextResponse.json(
        { error: 'Aucune affectation trouvée pour votre compte' },
        { status: 404 }
      )
    }

    const isManager = evaluateur.role === 'MANAGER' || evaluateur.role === 'ADMIN'

    const filteredCriteres = campagne.criteres.filter(
      (c) =>
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
