import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/qr/[token]
 * Public route — no auth required.
 * Returns agent info + active campaign criteria (type TOUS) for the QR evaluation form.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

  const agent = await prisma.utilisateur.findUnique({
    where: { qrToken: token },
    select: {
      id: true,
      nom: true,
      prenom: true,
      service: true,
      qrcodeActif: true,
      site: { select: { nom: true } },
    },
  })

  if (!agent || !agent.qrcodeActif) {
    return NextResponse.json({ error: 'QR code invalide ou désactivé' }, { status: 404 })
  }

  const campagne = await prisma.campagne.findFirst({
    where: { statut: 'OUVERTE' },
    select: {
      id: true,
      libelle: true,
      criteres: {
        where: {
          OR: [
            { typeEvaluateur: { in: ['CLIENT', 'TOUS'] } },
            { typeEvaluateurs: { hasSome: ['CLIENT', 'TOUS'] } }
          ]
        },
        select: { id: true, libelle: true, description: true, noteMaximale: true },
      },
    },
  })

  if (!campagne) {
    return NextResponse.json({ error: 'Aucune campagne active en ce moment' }, { status: 404 })
  }

  return NextResponse.json({
    agent: {
      id: agent.id,
      nom: agent.nom,
      prenom: agent.prenom,
      service: agent.service,
      site: agent.site?.nom ?? null,
    },
    campagne: {
      id: campagne.id,
      libelle: campagne.libelle,
      criteres: campagne.criteres,
    },
  })
}
