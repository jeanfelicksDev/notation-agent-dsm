import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { CRITERES_CLIENTS_DSM } from '@/lib/default-criteres'

/**
 * GET /api/qr/criteres
 * Public route.
 * Returns evaluation criteria for the active campaign (specifically the 3 client criteria).
 */
export async function GET() {
  try {
    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      include: {
        criteres: true,
      },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne active' }, { status: 404 })
    }

    // Look for criteria of type CLIENT
    let clientCriteres = campagne.criteres.filter(
      (c) => c.typeEvaluateur === 'CLIENT'
    )

    // If not found in database for this campaign, auto-create the 3 official client criteria
    if (clientCriteres.length === 0) {
      for (const crit of CRITERES_CLIENTS_DSM) {
        const created = await prisma.critere.create({
          data: {
            campagneId: campagne.id,
            libelle: crit.libelle,
            description: crit.description,
            noteMaximale: crit.noteMaximale,
            typeEvaluateur: 'CLIENT',
          },
        })
        clientCriteres.push(created)
      }
    }

    return NextResponse.json({
      campagne: {
        id: campagne.id,
        libelle: campagne.libelle,
        criteres: clientCriteres,
      },
    })
  } catch (error) {
    console.error('Fetch global criteria error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
