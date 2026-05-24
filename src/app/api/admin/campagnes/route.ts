import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const campagnes = await prisma.campagne.findMany({
      include: {
        _count: { select: { criteres: true, affectations: true } }
      },
      orderBy: { dateDebut: 'desc' }
    })
    return NextResponse.json(campagnes)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { libelle, dateDebut, dateFin, poidsCollegues, poidsManager } = await request.json()

    if (!libelle || !dateDebut || !dateFin) {
      return NextResponse.json({ error: 'Les champs obligatoires doivent être remplis' }, { status: 400 })
    }

    const campagne = await prisma.campagne.create({
      data: {
        libelle,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        poidsCollegues: poidsCollegues || 45,
        poidsManager: poidsManager || 55
      }
    })

    return NextResponse.json(campagne)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}