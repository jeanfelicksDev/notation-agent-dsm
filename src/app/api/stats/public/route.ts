import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { pourcentage } from '@/lib/participation'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stats/public
 * Route publique (page d'accueil) : campagne en cours, date limite et taux de soumission,
 * distingués entre pairs / clients internes et clients externes. Aucune donnée nominative.
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
    const externe = { campagneId: campagne.id, evaluateur: { role: 'EXTERNE' as const } }
    const [totalInterne, termineesInterne, totalExterne, termineesExterne] = await Promise.all([
      prisma.affectation.count({ where: interne }),
      prisma.affectation.count({ where: { ...interne, statut: 'TERMINEE' } }),
      prisma.affectation.count({ where: externe }),
      prisma.affectation.count({ where: { ...externe, statut: 'TERMINEE' } }),
    ])

    return NextResponse.json({
      campagne: {
        libelle: campagne.libelle,
        dateFin: campagne.dateFin,
        tauxInterne: pourcentage(termineesInterne, totalInterne),
        // null : aucun client externe n'a d'agent affecté, le taux n'a pas de sens.
        tauxExterne: totalExterne > 0 ? pourcentage(termineesExterne, totalExterne) : null,
      },
    })
  } catch (error) {
    console.error('Error fetching public stats:', error)
    return NextResponse.json({ campagne: null })
  }
}
