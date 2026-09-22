import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/[-()+]/g, '')
}

/**
 * POST /api/qr/[token]/verify-client
 * Public route.
 * Verifies if the client telephone exists in database for a user with role 'EXTERNE'.
 * Also checks if the client already evaluated this agent during the active campaign.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body.telephone !== 'string') {
      return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 })
    }

    const inputPhone = body.telephone.trim()
    if (!inputPhone) {
      return NextResponse.json({ error: 'Le numéro de téléphone est obligatoire' }, { status: 400 })
    }

    const cleanInputPhone = normalizePhone(inputPhone)

    // Find the agent by token
    const agent = await prisma.utilisateur.findUnique({
      where: { qrToken: token },
      select: { id: true, qrcodeActif: true },
    })

    if (!agent || !agent.qrcodeActif) {
      return NextResponse.json({ error: 'QR code invalide ou désactivé' }, { status: 404 })
    }

    // Find active campaign
    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      select: { id: true },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne active en ce moment' }, { status: 404 })
    }

    // Find all users with role 'EXTERNE' and match their normalized phone
    const externalUsers = await prisma.utilisateur.findMany({
      where: { role: 'EXTERNE' },
      select: { id: true, nom: true, prenom: true, telephone: true },
    })

    const matchedClient = externalUsers.find((u) => {
      return u.telephone && normalizePhone(u.telephone) === cleanInputPhone
    })

    if (!matchedClient) {
      return NextResponse.json(
        { error: 'Ce numéro de téléphone n’est pas enregistré comme client autorisé.' },
        { status: 404 }
      )
    }

    // Check if the client has already voted for this agent in this campaign
    const existing = await prisma.noteClient.findFirst({
      where: {
        clientId: matchedClient.id,
        agentId: agent.id,
        campagneId: campagne.id,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Vous avez déjà soumis votre avis pour cet agent.' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      client: {
        id: matchedClient.id,
        nom: matchedClient.nom,
        prenom: matchedClient.prenom,
      },
    })
  } catch (error: any) {
    console.error('Verify client error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la vérification du client' }, { status: 500 })
  }
}
