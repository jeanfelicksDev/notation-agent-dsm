import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    const affectations = await prisma.affectation.findMany({
      where: { campagneId: id }
    })
    return NextResponse.json(affectations)
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement des affectations' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    const { evaluateurId, evalueIds } = await req.json()

    if (!evaluateurId || !Array.isArray(evalueIds)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    // Use a transaction to update affectations for this evaluator
    await prisma.$transaction([
      // Delete existing affectations for this evaluator in this campaign
      prisma.affectation.deleteMany({
        where: {
          campagneId: id,
          evaluateurId: evaluateurId
        }
      }),
      // Create new ones
      ...evalueIds.map((evalueId: string) => 
        prisma.affectation.create({
          data: {
            campagneId: id,
            evaluateurId: evaluateurId,
            evalueId: evalueId
          }
        })
      )
    ])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Affectation error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour des affectations' }, { status: 500 })
  }
}
