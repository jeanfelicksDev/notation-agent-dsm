import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import prisma from '@/lib/prisma'

/**
 * POST /api/qr/[token]/submit
 * Public route — no auth required.
 * Saves client ratings. Limits to 1 vote per IP per campaign per agent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const agent = await prisma.utilisateur.findUnique({
    where: { qrToken: token },
    select: { id: true, qrcodeActif: true },
  })

  if (!agent || !agent.qrcodeActif) {
    return NextResponse.json({ error: 'QR code invalide ou désactivé' }, { status: 404 })
  }

  const campagne = await prisma.campagne.findFirst({
    where: { statut: 'OUVERTE' },
    select: { id: true },
  })

  if (!campagne) {
    return NextResponse.json({ error: 'Aucune campagne active' }, { status: 404 })
  }

  // IP-based deduplication: 1 vote per IP per agent per campaign
  const rawIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const ipHash = createHash('sha256').update(`${rawIp}:${agent.id}:${campagne.id}`).digest('hex')

  const existing = await prisma.noteClient.findFirst({
    where: { ipHash, agentId: agent.id, campagneId: campagne.id },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'Vous avez déjà soumis votre avis pour cet agent lors de cette campagne.' },
      { status: 409 }
    )
  }

  // Parse and validate body
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.notes) || typeof body.clientId !== 'string') {
    return NextResponse.json({ error: 'Corps de requête ou identifiant client invalide' }, { status: 400 })
  }

  const clientId = body.clientId.trim()
  if (!clientId) {
    return NextResponse.json({ error: 'Le clientId est requis' }, { status: 400 })
  }

  // Double check client exists and is role EXTERNE
  const clientUser = await prisma.utilisateur.findFirst({
    where: { id: clientId, role: 'EXTERNE' },
  })

  if (!clientUser) {
    return NextResponse.json({ error: 'Client non autorisé ou introuvable' }, { status: 403 })
  }

  // Deduplicate by clientId
  const existingByClient = await prisma.noteClient.findFirst({
    where: { clientId, agentId: agent.id, campagneId: campagne.id },
  })

  if (existingByClient) {
    return NextResponse.json(
      { error: 'Vous avez déjà soumis votre avis pour cet agent.' },
      { status: 409 }
    )
  }

  const existingByIp = await prisma.noteClient.findFirst({
    where: { ipHash, agentId: agent.id, campagneId: campagne.id },
  })

  if (existingByIp) {
    return NextResponse.json(
      { error: 'Une évaluation a déjà été soumise depuis cet appareil.' },
      { status: 409 }
    )
  }

  const notes: { critereId: string; valeur: number; commentaire?: string }[] = body.notes
  if (notes.length === 0) {
    return NextResponse.json({ error: 'Aucune note fournie' }, { status: 400 })
  }

  // Validate all critereIds belong to the active campaign and are type TOUS
  const critereIds = notes.map((n) => n.critereId)
  const criteres = await prisma.critere.findMany({
    where: { id: { in: critereIds }, campagneId: campagne.id, typeEvaluateur: 'TOUS' },
    select: { id: true, noteMaximale: true },
  })

  const critereMap = new Map(criteres.map((c) => [c.id, c]))

  for (const note of notes) {
    const critere = critereMap.get(note.critereId)
    if (!critere) {
      return NextResponse.json(
        { error: `Critère invalide : ${note.critereId}` },
        { status: 400 }
      )
    }
    if (note.valeur < 1 || note.valeur > critere.noteMaximale) {
      return NextResponse.json(
        { error: `Note hors plage pour le critère ${note.critereId}` },
        { status: 400 }
      )
    }
  }

  // Insert all notes in one transaction
  await prisma.$transaction(
    notes.map((note) =>
      prisma.noteClient.create({
        data: {
          agentId: agent.id,
          campagneId: campagne.id,
          critereId: note.critereId,
          valeur: note.valeur,
          commentaire: note.commentaire?.trim() || null,
          ipHash,
          clientId,
        },
      })
    )
  )

  return NextResponse.json({ success: true })
}
