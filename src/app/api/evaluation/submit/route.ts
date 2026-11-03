import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { getCampagneOuverte } from '@/lib/campagne'
import { ErreurNotation, preparerNotation, type NoteEntrante } from '@/lib/notation'
import { noteJustifiee, SEUIL_COMMENTAIRE_OBLIGATOIRE } from '@/lib/commentaire-obligatoire'

/**
 * POST /api/evaluation/submit — soumission définitive.
 * Toutes les affectations de l'évaluateur sont verrouillées d'un coup, et seulement si
 * chaque collaborateur a une note pour chacun de ses critères.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Session expirée' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const notes: NoteEntrante[] = Array.isArray(body?.notes) ? body.notes : []

    const campagneOuverte = await getCampagneOuverte()
    if (!campagneOuverte) {
      return NextResponse.json({ error: 'Aucune campagne ouverte.' }, { status: 404 })
    }

    // La soumission porte sur l'ensemble des collaborateurs encore ouverts de l'évaluateur.
    const ouvertes = await prisma.affectation.findMany({
      where: {
        evaluateurId: sessionUser.id,
        statut: { not: 'TERMINEE' },
        invalidee: false,
        campagneId: campagneOuverte.id,
        evalueId: { not: sessionUser.id },
      },
      select: { evalueId: true },
    })
    const evalueIds = [...new Set(ouvertes.map((a) => a.evalueId))]
    if (evalueIds.length === 0) {
      return NextResponse.json({ error: 'Vos évaluations ont déjà été soumises.' }, { status: 409 })
    }

    const { campagne, affectations, attendus, valider } = await preparerNotation(sessionUser.id, evalueIds)
    const valides = valider(notes)

    await prisma.$transaction(
      async (tx) => {
        for (const n of valides) {
          await tx.note.upsert({
            where: {
              evaluateurId_evalueId_critereId_campagneId: {
                evaluateurId: sessionUser.id,
                evalueId: n.evalueId,
                critereId: n.critereId,
                campagneId: campagne.id,
              },
            },
            update: { valeur: n.valeur, commentaire: n.commentaire },
            create: { ...n, evaluateurId: sessionUser.id, campagneId: campagne.id },
          })
        }

        // Contrôle sur l'état final en base (brouillons antérieurs inclus) : chaque critère noté,
        // et toute note basse justifiée par un commentaire.
        const enBase = await tx.note.findMany({
          where: { evaluateurId: sessionUser.id, campagneId: campagne.id, evalueId: { in: evalueIds } },
          select: { evalueId: true, critereId: true, valeur: true, commentaire: true },
        })
        const notees = new Map(enBase.map((n) => [`${n.evalueId}:${n.critereId}`, n]))
        for (const a of affectations) {
          for (const c of attendus.get(a.evalueId) ?? []) {
            const note = notees.get(`${a.evalueId}:${c.id}`)
            if (!note) {
              throw new ErreurNotation(`Le critère « ${c.libelle} » n'est pas noté pour ${a.evalue.prenom} ${a.evalue.nom}.`, 400)
            }
            if (!noteJustifiee(note.valeur, note.commentaire)) {
              throw new ErreurNotation(
                `Un commentaire est obligatoire pour la note ${note.valeur} au critère « ${c.libelle} » de ${a.evalue.prenom} ${a.evalue.nom} (toute note inférieure ou égale à ${SEUIL_COMMENTAIRE_OBLIGATOIRE} doit être justifiée).`,
                400
              )
            }
          }
        }

        await tx.affectation.updateMany({
          where: { evaluateurId: sessionUser.id, campagneId: campagne.id, evalueId: { in: evalueIds } },
          data: { statut: 'TERMINEE', termineeAt: new Date() },
        })
      },
      { timeout: 20000 }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ErreurNotation) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('evaluation/submit error:', error)
    return NextResponse.json({ error: "La soumission n'a pas abouti. Vos notes sont conservées en brouillon." }, { status: 500 })
  }
}
