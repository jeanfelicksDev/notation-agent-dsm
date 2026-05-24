import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

type IncomingNote = {
  critereId: string
  valeur: number
  commentaire?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Session expirée' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
    }

    const evalueId = typeof body.evalueId === 'string' ? body.evalueId : ''
    const notes: IncomingNote[] = Array.isArray(body.notes) ? body.notes : []

    if (!evalueId) {
      return NextResponse.json({ error: 'evalueId requis' }, { status: 400 })
    }

    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne ouverte' }, { status: 404 })
    }

    // S'assurer que l'évaluateur a bien été affecté à cet évalué pour cette campagne
    const affectation = await prisma.affectation.findUnique({
      where: {
        evaluateurId_evalueId_campagneId: {
          evaluateurId: sessionUser.id,
          evalueId,
          campagneId: campagne.id,
        },
      },
    })

    if (!affectation) {
      return NextResponse.json(
        { error: 'Vous n\'êtes pas affecté à cette évaluation' },
        { status: 403 }
      )
    }

    if (affectation.statut === 'TERMINEE') {
      return NextResponse.json(
        { error: 'Cette évaluation a déjà été soumise et est verrouillée' },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      for (const note of notes) {
        if (typeof note?.critereId !== 'string') continue
        if (typeof note.valeur !== 'number' || note.valeur <= 0) continue

        const existing = await tx.note.findFirst({
          where: {
            evaluateurId: sessionUser.id,
            evalueId,
            critereId: note.critereId,
            campagneId: campagne.id,
          },
        })

        if (existing) {
          await tx.note.update({
            where: { id: existing.id },
            data: {
              valeur: note.valeur,
              commentaire: note.commentaire ?? null,
            },
          })
        } else {
          await tx.note.create({
            data: {
              valeur: note.valeur,
              commentaire: note.commentaire ?? null,
              evaluateurId: sessionUser.id,
              evalueId,
              critereId: note.critereId,
              campagneId: campagne.id,
            },
          })
        }
      }

      await tx.affectation.update({
        where: {
          evaluateurId_evalueId_campagneId: {
            evaluateurId: sessionUser.id,
            evalueId,
            campagneId: campagne.id,
          },
        },
        data: { statut: 'BROUILLON' },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving draft:', error)
    const msg = error instanceof Error ? error.message : 'Inconnue'
    return NextResponse.json({ error: 'Erreur serveur: ' + msg }, { status: 500 })
  }
}
