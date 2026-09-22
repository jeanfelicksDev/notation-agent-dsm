import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import prisma from '@/lib/prisma'

/**
 * POST /api/qr/submit
 * Public route.
 * Submits client ratings for a specific agent.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (
      !body ||
      !Array.isArray(body.notes) ||
      typeof body.clientId !== 'string' ||
      typeof body.agentId !== 'string'
    ) {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const clientId = body.clientId.trim()
    const agentId = body.agentId.trim()

    if (!clientId || !agentId) {
      return NextResponse.json({ error: 'clientId et agentId sont requis' }, { status: 400 })
    }

    // Find active campaign
    const campagne = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      select: { id: true },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne active' }, { status: 404 })
    }

    // Check if client is EXTERNE
    const clientUser = await prisma.utilisateur.findFirst({
      where: { id: clientId, role: 'EXTERNE' },
    })

    if (!clientUser) {
      return NextResponse.json({ error: 'Client non autorisé' }, { status: 403 })
    }

    // Check if agent has qrcodeActif
    const agent = await prisma.utilisateur.findFirst({
      where: { id: agentId, qrcodeActif: true },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Cet agent n’est pas configuré pour la notation par QR code.' }, { status: 404 })
    }

    // Check if restrictive affectations exist for this client in this campaign
    const anyAffectationsForClient = await prisma.affectation.findFirst({
      where: {
        evaluateurId: clientId,
        campagneId: campagne.id,
      },
    })

    if (anyAffectationsForClient) {
      const specificAffectation = await prisma.affectation.findFirst({
        where: {
          evaluateurId: clientId,
          evalueId: agentId,
          campagneId: campagne.id,
        },
      })
      if (!specificAffectation) {
        return NextResponse.json({ error: 'Vous n’êtes pas autorisé à évaluer cet agent.' }, { status: 403 })
      }
    }

    // Check if client has already voted for this agent in this campaign
    const existingByClient = await prisma.noteClient.findFirst({
      where: { clientId, agentId, campagneId: campagne.id },
    })

    if (existingByClient) {
      return NextResponse.json(
        { error: 'Vous avez déjà soumis votre avis pour cet agent.' },
        { status: 409 }
      )
    }

    // IP deduplication (second layer)
    const rawIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const ipHash = createHash('sha256').update(`${rawIp}:${agentId}:${campagne.id}`).digest('hex')

    const existingByIp = await prisma.noteClient.findFirst({
      where: { ipHash, agentId, campagneId: campagne.id },
    })

    if (existingByIp) {
      return NextResponse.json(
        { error: 'Une évaluation a déjà été soumise depuis cet appareil pour cet agent.' },
        { status: 409 }
      )
    }

    const notes: { critereId: string; valeur: number; commentaire?: string }[] = body.notes
    if (notes.length === 0) {
      return NextResponse.json({ error: 'Aucune note fournie' }, { status: 400 })
    }

    // Validate criteria
    const critereIds = notes.map((n) => n.critereId)
    const criteres = await prisma.critere.findMany({
      where: { id: { in: critereIds }, campagneId: campagne.id },
      select: { id: true, noteMaximale: true },
    })

    const critereMap = new Map(criteres.map((c) => [c.id, c]))

    for (const note of notes) {
      const critere = critereMap.get(note.critereId)
      if (!critere) {
        return NextResponse.json({ error: `Critère invalide : ${note.critereId}` }, { status: 400 })
      }
      if (note.valeur < 1 || note.valeur > critere.noteMaximale) {
        return NextResponse.json(
          { error: `Note hors plage pour le critère ${note.critereId}` },
          { status: 400 }
        )
      }
    }

    // Save in transaction: create NoteClient entries and update/create Affectation as TERMINEE
    await prisma.$transaction([
      ...notes.map((note) =>
        prisma.noteClient.create({
          data: {
            agentId,
            campagneId: campagne.id,
            critereId: note.critereId,
            valeur: note.valeur,
            commentaire: note.commentaire?.trim() || null,
            ipHash,
            clientId,
          },
        })
      ),
      prisma.affectation.upsert({
        where: {
          evaluateurId_evalueId_campagneId: {
            evaluateurId: clientId,
            evalueId: agentId,
            campagneId: campagne.id,
          },
        },
        update: { statut: 'TERMINEE' },
        create: {
          evaluateurId: clientId,
          evalueId: agentId,
          campagneId: campagne.id,
          statut: 'TERMINEE',
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Submit global client error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la soumission' }, { status: 500 })
  }
}
