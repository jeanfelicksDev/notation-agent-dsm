import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { normaliserTypes } from '@/lib/criteres'

const BAREMES = new Set([5, 10])

async function critereDeLaCampagne(campagneId: string, critereId: string) {
  return prisma.critere.findFirst({
    where: { id: critereId, campagneId },
    include: { _count: { select: { notes: true, notesClients: true } } },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; critereId: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id, critereId } = await params
    const actuel = await critereDeLaCampagne(id, critereId)
    if (!actuel) return NextResponse.json({ error: 'Critère introuvable' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
    const data: Prisma.CritereUpdateInput = {}
    const dejaNote = actuel._count.notes + actuel._count.notesClients > 0

    if (has('libelle')) {
      const libelle = String(body.libelle ?? '').trim()
      if (!libelle) return NextResponse.json({ error: 'Le libellé est obligatoire.' }, { status: 400 })
      data.libelle = libelle
    }
    if (has('description')) {
      data.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
    }
    if (has('noteMaximale') && Number(body.noteMaximale) !== actuel.noteMaximale) {
      if (!BAREMES.has(Number(body.noteMaximale))) {
        return NextResponse.json({ error: 'Le barème doit être sur 5 ou sur 10.' }, { status: 400 })
      }
      // Changer le barème après coup fausserait les notes déjà données.
      if (dejaNote) {
        return NextResponse.json({ error: 'Ce critère a déjà été noté : son barème ne peut plus changer.' }, { status: 409 })
      }
      data.noteMaximale = Number(body.noteMaximale)
    }
    if (has('typeEvaluateurs') || has('typeEvaluateur')) {
      Object.assign(data, normaliserTypes(body.typeEvaluateurs, body.typeEvaluateur))
    }

    const critere = await prisma.critere.update({ where: { id: critereId }, data })
    return NextResponse.json(critere)
  } catch (error) {
    console.error('API PATCH Error [critereId]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; critereId: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id, critereId } = await params
    const actuel = await critereDeLaCampagne(id, critereId)
    if (!actuel) return NextResponse.json({ error: 'Critère introuvable' }, { status: 404 })

    await prisma.$transaction([
      prisma.note.deleteMany({ where: { critereId } }),
      prisma.noteClient.deleteMany({ where: { critereId } }),
      prisma.critere.delete({ where: { id: critereId } }),
    ])

    return NextResponse.json({
      message: 'Critère supprimé',
      notesSupprimees: actuel._count.notes + actuel._count.notesClients,
    })
  } catch (error) {
    console.error('API DELETE Error [critereId]:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression du critère' }, { status: 500 })
  }
}
