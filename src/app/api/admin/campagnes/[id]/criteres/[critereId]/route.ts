import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, critereId: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { critereId } = await params
    const { libelle, description, noteMaximale, typeEvaluateur } = await request.json()

    const critere = await prisma.critere.update({
      where: { id: critereId },
      data: {
        libelle,
        description,
        noteMaximale,
        typeEvaluateur
      }
    })

    return NextResponse.json(critere)
  } catch (error) {
    console.error('API PATCH Error [critereId]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, critereId: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { critereId } = await params
    await prisma.critere.delete({
      where: { id: critereId }
    })

    return NextResponse.json({ message: 'Critère supprimé avec succès' })
  } catch (error) {
    console.error('API DELETE Error [critereId]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
