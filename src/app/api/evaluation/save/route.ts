import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { ErreurNotation, preparerNotation, type NoteEntrante } from '@/lib/notation'

/** POST /api/evaluation/save — enregistre le brouillon d'un collaborateur. */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Session expirée' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const evalueId = typeof body?.evalueId === 'string' ? body.evalueId : ''
    const notes: NoteEntrante[] = Array.isArray(body?.notes) ? body.notes : []
    if (!evalueId) {
      return NextResponse.json({ error: 'Collaborateur manquant' }, { status: 400 })
    }

    const { campagne, valider } = await preparerNotation(sessionUser.id, [evalueId])
    const valides = valider(notes.map((n) => ({ ...n, evalueId })))

    await prisma.$transaction([
      ...valides.map((n) =>
        prisma.note.upsert({
          where: {
            evaluateurId_evalueId_critereId_campagneId: {
              evaluateurId: sessionUser.id,
              evalueId,
              critereId: n.critereId,
              campagneId: campagne.id,
            },
          },
          update: { valeur: n.valeur, commentaire: n.commentaire },
          create: { ...n, evaluateurId: sessionUser.id, campagneId: campagne.id },
        })
      ),
      prisma.affectation.update({
        where: { evaluateurId_evalueId_campagneId: { evaluateurId: sessionUser.id, evalueId, campagneId: campagne.id } },
        data: { statut: 'BROUILLON' },
      }),
    ])

    return NextResponse.json({ success: true, savedAt: new Date().toISOString() })
  } catch (error) {
    if (error instanceof ErreurNotation) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('evaluation/save error:', error)
    return NextResponse.json({ error: "Le brouillon n'a pas pu être enregistré." }, { status: 500 })
  }
}
