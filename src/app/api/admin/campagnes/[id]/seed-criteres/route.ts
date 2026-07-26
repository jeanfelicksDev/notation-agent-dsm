import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { CRITERES_OFFICIELS_DSM } from '@/lib/default-criteres'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params

    const campagne = await prisma.campagne.findUnique({ where: { id } })
    if (!campagne) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    // Supprimer les critères actuels de cette campagne
    await prisma.critere.deleteMany({ where: { campagneId: id } })

    // Réinsérer les 15 critères officiels DSM
    await prisma.critere.createMany({
      data: CRITERES_OFFICIELS_DSM.map((c) => ({
        libelle: c.libelle,
        description: c.description,
        noteMaximale: c.noteMaximale,
        typeEvaluateur: c.typeEvaluateur,
        campagneId: id,
      })),
    })

    const newCriteres = await prisma.critere.findMany({
      where: { campagneId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      message: 'Les 15 critères officiels DSM ont été appliqués.',
      criteres: newCriteres,
    })
  } catch (error) {
    console.error('Error seeding criteres:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
