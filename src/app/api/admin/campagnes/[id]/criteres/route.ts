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
    const criteres = await prisma.critere.findMany({
      where: { campagneId: id },
      orderBy: { createdAt: 'asc' }
    })
    return NextResponse.json(criteres)
  } catch (error) {
    console.error('API GET Error [criteres]:', error)
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
    const { libelle, description, noteMaximale, typeEvaluateur } = await request.json()

    const critere = await prisma.critere.create({
      data: {
        libelle,
        description,
        noteMaximale: noteMaximale || 5,
        typeEvaluateur: typeEvaluateur || 'COLLEGUE',
        campagneId: id
      }
    })

    return NextResponse.json(critere)
  } catch (error) {
    console.error('API POST Error [criteres]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
