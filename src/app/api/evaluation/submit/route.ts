import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

type IncomingNote = {
  evalueId: string
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
    const notes: IncomingNote[] = Array.isArray(body?.notes) ? body.notes : []

    if (notes.length === 0) {
      return NextResponse.json({ error: 'Aucune note à soumettre' }, { status: 400 })
    }

    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne ouverte' }, { status: 404 })
    }

    const evalueIds = [...new Set(notes.map((n) => n.evalueId).filter(Boolean))]

    // Vérifier que toutes les affectations appartiennent bien à l'évaluateur connecté
    const myAffectations = await prisma.affectation.findMany({
      where: {
        evaluateurId: sessionUser.id,
        campagneId: campagne.id,
        evalueId: { in: evalueIds },
      },
    })

    if (myAffectations.length !== evalueIds.length) {
      return NextResponse.json(
        { error: 'Certaines évaluations ne vous sont pas affectées' },
        { status: 403 }
      )
    }

    if (myAffectations.some((a) => a.statut === 'TERMINEE')) {
      return NextResponse.json(
        { error: 'Une partie des évaluations a déjà été soumise' },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      for (const note of notes) {
        if (typeof note?.critereId !== 'string' || typeof note?.evalueId !== 'string') {
          continue
        }
        if (typeof note.valeur !== 'number' || note.valeur <= 0) continue

        const existing = await tx.note.findFirst({
          where: {
            evaluateurId: sessionUser.id,
            evalueId: note.evalueId,
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
              evalueId: note.evalueId,
              critereId: note.critereId,
              campagneId: campagne.id,
            },
          })
        }
      }

      for (const evalueId of evalueIds) {
        await tx.affectation.update({
          where: {
            evaluateurId_evalueId_campagneId: {
              evaluateurId: sessionUser.id,
              evalueId,
              campagneId: campagne.id,
            },
          },
          data: { statut: 'TERMINEE' },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error submitting evaluation:', error)
    let msg = error instanceof Error ? error.message : 'Inconnue'
    if (msg.includes('Foreign key constraint failed')) {
      msg = "Erreur de contrainte : un évaluateur ou un évalué n'existe plus."
    }
    return NextResponse.json({ error: 'Erreur serveur: ' + msg }, { status: 500 })
  }
}
