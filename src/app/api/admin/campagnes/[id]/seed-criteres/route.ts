import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { CRITERES_OFFICIELS_DSM } from '@/lib/default-criteres'
import { normaliserTypes, typesDuCritere } from '@/lib/criteres'

// PATCH : met à jour les descriptions des critères officiels existants, sans toucher aux notes.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const existingCriteres = await prisma.critere.findMany({ where: { campagneId: id } })

    let updatedCount = 0
    for (const officiel of CRITERES_OFFICIELS_DSM) {
      const typesOfficiels = normaliserTypes([officiel.typeEvaluateur]).typeEvaluateurs.join(',')
      const match = existingCriteres.find(
        (c) => c.libelle === officiel.libelle && typesDuCritere(c).join(',') === typesOfficiels
      )
      if (match) {
        await prisma.critere.update({ where: { id: match.id }, data: { description: officiel.description } })
        updatedCount++
      }
    }

    const criteres = await prisma.critere.findMany({ where: { campagneId: id }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json({
      success: true,
      message: `${updatedCount} description(s) de critère mise(s) à jour.`,
      criteres,
    })
  } catch (error) {
    console.error('Error updating critere descriptions:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST : remplace TOUS les critères de la campagne par la grille officielle (supprime les notes associées).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const campagne = await prisma.campagne.findUnique({ where: { id }, select: { id: true } })
    if (!campagne) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.note.deleteMany({ where: { campagneId: id } }),
      prisma.noteClient.deleteMany({ where: { campagneId: id } }),
      prisma.scoreFinal.deleteMany({ where: { campagneId: id } }),
      prisma.critere.deleteMany({ where: { campagneId: id } }),
      prisma.critere.createMany({
        data: CRITERES_OFFICIELS_DSM.map((c) => ({
          libelle: c.libelle,
          description: c.description,
          noteMaximale: c.noteMaximale,
          ...normaliserTypes([c.typeEvaluateur]),
          campagneId: id,
        })),
      }),
    ])

    const criteres = await prisma.critere.findMany({ where: { campagneId: id }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json({
      success: true,
      message: `Les ${criteres.length} critères officiels DSM ont été appliqués.`,
      criteres,
    })
  } catch (error) {
    console.error('Error seeding criteres:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
