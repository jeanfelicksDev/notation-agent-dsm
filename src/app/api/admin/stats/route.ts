import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const [totalUtilisateurs, totalCampagnes, campagnesOuvertes] = await Promise.all([
      prisma.utilisateur.count(),
      prisma.campagne.count(),
      prisma.campagne.count({ where: { statut: 'OUVERTE' } })
    ])

    return NextResponse.json({
      totalUtilisateurs,
      totalCampagnes,
      campagnesOuvertes
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}