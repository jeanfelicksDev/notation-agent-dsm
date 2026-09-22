import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { CRITERES_OFFICIELS_DSM } from '@/lib/default-criteres'

// PATCH : Met à jour uniquement les descriptions des critères existants (sans supprimer les notes)
export async function PATCH(
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

    const existingCriteres = await prisma.critere.findMany({ where: { campagneId: id } })

    let updatedCount = 0

    for (const officiel of CRITERES_OFFICIELS_DSM) {
      // Trouver le critère correspondant par libellé ET typeEvaluateur
      const match = existingCriteres.find(
        (c) => c.libelle === officiel.libelle && c.typeEvaluateur === officiel.typeEvaluateur
      )
      if (match) {
        await prisma.critere.update({
          where: { id: match.id },
          data: {
            description: officiel.description,
            noteMaximale: officiel.noteMaximale,
          },
        })
        updatedCount++
      }
    }

    const updatedCriteres = await prisma.critere.findMany({
      where: { campagneId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      message: `${updatedCount} critère(s) mis à jour avec barème sur 5 points.`,
      criteres: updatedCriteres,
    })
  } catch (error) {
    console.error('Error updating critere descriptions:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

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

    // Supprimer les notes et critères actuels de cette campagne
    const existingCriteres = await prisma.critere.findMany({ where: { campagneId: id }, select: { id: true } })
    const critereIds = existingCriteres.map(c => c.id)
    if (critereIds.length > 0) {
      await Promise.all([
        prisma.note.deleteMany({ where: { critereId: { in: critereIds } } }),
        prisma.noteClient.deleteMany({ where: { critereId: { in: critereIds } } }),
      ])
    }
    await prisma.critere.deleteMany({ where: { campagneId: id } })

    // Réinsérer tous les critères officiels DSM (tous sur 5 points)
    await prisma.critere.createMany({
      data: CRITERES_OFFICIELS_DSM.map((c) => ({
        libelle: c.libelle,
        description: c.description,
        noteMaximale: 5,
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
      message: 'Les 11 critères officiels DSM ont été appliqués.',
      criteres: newCriteres,
    })
  } catch (error) {
    console.error('Error seeding criteres:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
