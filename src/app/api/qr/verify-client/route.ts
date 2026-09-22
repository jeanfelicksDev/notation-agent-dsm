import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/[-()+]/g, '')
}

/**
 * POST /api/qr/verify-client
 * Public route.
 * Verifies if the client telephone exists for an 'EXTERNE' user.
 * Returns the list of authorized agents (with qrcodeActif=true) for this client in the active campaign.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.telephone !== 'string') {
      return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 })
    }

    const inputPhone = body.telephone.trim()
    if (!inputPhone) {
      return NextResponse.json({ error: 'Le numéro de téléphone est obligatoire' }, { status: 400 })
    }

    const cleanInputPhone = normalizePhone(inputPhone)

    // Find active campaign
    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      select: { id: true, libelle: true },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne active en ce moment' }, { status: 404 })
    }

    // Find all users with role 'EXTERNE' and match their normalized phone or matricule
    const externalUsers = await prisma.utilisateur.findMany({
      where: { role: 'EXTERNE' },
      select: { id: true, nom: true, prenom: true, telephone: true, matricule: true },
    })

    let matchedClient = externalUsers.find((u) => {
      const matchPhone = u.telephone && (
        normalizePhone(u.telephone) === cleanInputPhone ||
        normalizePhone(u.telephone).endsWith(cleanInputPhone) ||
        cleanInputPhone.endsWith(normalizePhone(u.telephone))
      )
      const matchMatricule = u.matricule && (
        normalizePhone(u.matricule) === cleanInputPhone ||
        u.matricule.toLowerCase() === inputPhone.toLowerCase()
      )
      return matchPhone || matchMatricule
    })

    // If not found in EXTERNE, check across all users as fallback
    if (!matchedClient) {
      const allUsers = await prisma.utilisateur.findMany({
        select: { id: true, nom: true, prenom: true, telephone: true, matricule: true },
      })
      matchedClient = allUsers.find((u) => {
        const matchPhone = u.telephone && (
          normalizePhone(u.telephone) === cleanInputPhone ||
          normalizePhone(u.telephone).endsWith(cleanInputPhone) ||
          cleanInputPhone.endsWith(normalizePhone(u.telephone))
        )
        const matchMatricule = u.matricule && (
          normalizePhone(u.matricule) === cleanInputPhone ||
          u.matricule.toLowerCase() === inputPhone.toLowerCase()
        )
        return matchPhone || matchMatricule
      }) || undefined
    }

    if (!matchedClient) {
      return NextResponse.json(
        { error: 'Ce numéro de téléphone ou matricule n’est pas enregistré comme client/évaluateur autorisé.' },
        { status: 404 }
      )
    }

    // 1. Check if specific affectations were assigned to this client in this campaign
    const affectations = await prisma.affectation.findMany({
      where: {
        evaluateurId: matchedClient.id,
        campagneId: campagne.id,
        evalue: { qrcodeActif: true },
      },
      include: {
        evalue: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            service: true,
            site: { select: { nom: true } },
          },
        },
      },
    })

    let targetAgents: Array<{ id: string; nom: string; prenom: string; service: string | null; site: { nom: string } | null }> = []

    if (affectations.length > 0) {
      targetAgents = affectations.map((aff) => aff.evalue)
    } else {
      // If no restrictive affectation, all agents with qrcodeActif: true are evaluable
      targetAgents = await prisma.utilisateur.findMany({
        where: {
          qrcodeActif: true,
          role: { not: 'EXTERNE' },
        },
        select: {
          id: true,
          nom: true,
          prenom: true,
          service: true,
          site: { select: { nom: true } },
        },
        orderBy: { nom: 'asc' },
      })
    }

    // For each agent, check if the client has already rated them in this campaign
    const clientNotes = await prisma.noteClient.findMany({
      where: {
        clientId: matchedClient.id,
        campagneId: campagne.id,
      },
      select: { agentId: true },
    })
    const ratedAgentIds = new Set(clientNotes.map((n) => n.agentId))

    const agents = targetAgents.map((ag) => {
      const isRated = ratedAgentIds.has(ag.id)
      return {
        id: ag.id,
        nom: ag.nom,
        prenom: ag.prenom,
        service: ag.service,
        site: ag.site?.nom || null,
        hasRated: isRated,
      }
    })

    return NextResponse.json({
      success: true,
      client: {
        id: matchedClient.id,
        nom: matchedClient.nom,
        prenom: matchedClient.prenom,
      },
      campagne: {
        id: campagne.id,
        libelle: campagne.libelle,
      },
      agents,
    })
  } catch (error: any) {
    console.error('Verify client global error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la vérification du client' }, { status: 500 })
  }
}
