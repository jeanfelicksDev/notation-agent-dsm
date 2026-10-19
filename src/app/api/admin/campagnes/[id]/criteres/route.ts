import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { normaliserTypes } from '@/lib/criteres'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const criteres = await prisma.critere.findMany({
      where: { campagneId: id },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { notes: true, notesClients: true } } },
    })
    return NextResponse.json(criteres)
  } catch (error) {
    console.error('API GET Error [criteres]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

const BAREMES = new Set([5, 10])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const libelle = typeof body.libelle === 'string' ? body.libelle.trim() : ''
    const noteMaximale = Number(body.noteMaximale ?? 5)

    if (!libelle) return NextResponse.json({ error: 'Le libellé est obligatoire.' }, { status: 400 })
    if (!BAREMES.has(noteMaximale)) {
      return NextResponse.json({ error: 'Le barème doit être sur 5 ou sur 10.' }, { status: 400 })
    }

    const critere = await prisma.critere.create({
      data: {
        libelle,
        description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
        noteMaximale,
        ...normaliserTypes(body.typeEvaluateurs, body.typeEvaluateur),
        campagneId: id,
      },
    })

    return NextResponse.json(critere)
  } catch (error) {
    console.error('API POST Error [criteres]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
