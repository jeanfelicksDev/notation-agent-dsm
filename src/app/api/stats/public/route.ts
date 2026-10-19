import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stats/public
 * Route publique (page d'accueil) : campagne en cours, date limite et avancement global.
 * Aucune donnée nominative.
 */
export async function GET() {
  try {
    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      select: { id: true, libelle: true, dateFin: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!campagne) {
      return NextResponse.json({ campagne: null })
    }

    const interne = { campagneId: campagne.id, evaluateur: { role: { not: 'EXTERNE' as const } } }
    const [total, terminees] = await Promise.all([
      prisma.affectation.count({ where: interne }),
      prisma.affectation.count({ where: { ...interne, statut: 'TERMINEE' } }),
    ])

    return NextResponse.json({
      campagne: {
        libelle: campagne.libelle,
        dateFin: campagne.dateFin,
        completionRate: total > 0 ? Math.round((terminees / total) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('Error fetching public stats:', error)
    return NextResponse.json({ campagne: null })
  }
}
