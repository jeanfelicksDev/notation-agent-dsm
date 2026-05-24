import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const campagne = await prisma.campagne.findUnique({
      where: { id },
      include: {
        criteres: true,
        _count: { select: { affectations: true, notes: true } }
      }
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Campagne non trouvée' }, { status: 404 })
    }

    return NextResponse.json(campagne)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const { libelle, dateDebut, dateFin, poidsCollegues, poidsManager, statut } = await request.json()

    const campagne = await prisma.campagne.update({
      where: { id },
      data: {
        libelle,
        dateDebut: dateDebut ? new Date(dateDebut) : undefined,
        dateFin: dateFin ? new Date(dateFin) : undefined,
        poidsCollegues,
        poidsManager,
        statut
      }
    })

    return NextResponse.json(campagne)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.campagne.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Campagne supprimée avec succès' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
