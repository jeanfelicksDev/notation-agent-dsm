import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCampagneOuverte } from '@/lib/campagne'
import { estClientExterne } from '@/lib/criteres'

/**
 * GET /api/qr/criteres — route publique.
 * Critères « clients externes » de la campagne ouverte. Lecture seule : si la campagne n'en
 * comporte pas, c'est à l'administration de les ajouter (bouton « grille officielle »).
 */
export async function GET() {
  try {
    const campagne = await getCampagneOuverte()
    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne d’évaluation n’est ouverte en ce moment.' }, { status: 404 })
    }

    const criteres = await prisma.critere.findMany({
      where: { campagneId: campagne.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, libelle: true, description: true, noteMaximale: true, typeEvaluateur: true, typeEvaluateurs: true },
    })
    const clientCriteres = criteres
      .filter(estClientExterne)
      .map(({ id, libelle, description, noteMaximale }) => ({ id, libelle, description, noteMaximale }))

    if (clientCriteres.length === 0) {
      return NextResponse.json({ error: 'Le questionnaire client n’est pas encore configuré pour cette campagne.' }, { status: 404 })
    }

    return NextResponse.json({
      campagne: { id: campagne.id, libelle: campagne.libelle, criteres: clientCriteres },
    })
  } catch (error) {
    console.error('qr/criteres error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
