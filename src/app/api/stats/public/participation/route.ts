import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { courbeQuotidienne, tauxParService } from '@/lib/participation'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stats/public/participation
 * Route publique (modal de la page d'accueil) : participation des pairs et clients internes
 * de la campagne ouverte, par service du notant et jour par jour. Chiffres agrégés uniquement.
 */
export async function GET() {
  try {
    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      select: { id: true, dateDebut: true, dateFin: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne ouverte.' }, { status: 404 })
    }

    const lignes = await prisma.affectation.findMany({
      where: { campagneId: campagne.id, evaluateur: { role: { not: 'EXTERNE' } } },
      select: { evaluateurId: true, statut: true, termineeAt: true, evaluateur: { select: { service: true } } },
    })
    const affectations = lignes.map(({ evaluateur, ...a }) => ({ ...a, service: evaluateur.service }))

    return NextResponse.json({
      services: tauxParService(affectations),
      jours: courbeQuotidienne(affectations, { debut: campagne.dateDebut, fin: campagne.dateFin }),
      notantsAttendus: new Set(affectations.map((a) => a.evaluateurId)).size,
    })
  } catch (error) {
    console.error('Error fetching public participation:', error)
    return NextResponse.json({ error: 'Impossible de charger la participation.' }, { status: 500 })
  }
}
