import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import prisma from '@/lib/prisma'
import { clientIp } from '@/lib/auth'
import { getCampagneOuverte, campagneEnCours, messageHorsPeriode } from '@/lib/campagne'
import { estClientExterne } from '@/lib/criteres'
import { agentsEvaluablesPar } from '@/lib/client-qr'

/**
 * POST /api/qr/submit — route publique.
 * Enregistre l'avis d'un client externe sur un agent : un seul avis par client, par agent et par campagne.
 * (L'adresse IP n'est plus un critère de blocage : tous les clients d'un même bureau la partagent.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : ''
    const agentId = typeof body?.agentId === 'string' ? body.agentId.trim() : ''
    const notes: { critereId?: unknown; valeur?: unknown; commentaire?: unknown }[] = Array.isArray(body?.notes) ? body.notes : []

    if (!clientId || !agentId || notes.length === 0) {
      return NextResponse.json({ error: 'Requête incomplète.' }, { status: 400 })
    }

    const campagne = await getCampagneOuverte()
    if (!campagne) return NextResponse.json({ error: 'Aucune campagne active.' }, { status: 404 })
    if (!campagneEnCours(campagne)) return NextResponse.json({ error: messageHorsPeriode(campagne) }, { status: 403 })

    const client = await prisma.utilisateur.findFirst({ where: { id: clientId, role: 'EXTERNE' }, select: { id: true } })
    if (!client) return NextResponse.json({ error: 'Client non reconnu.' }, { status: 403 })

    const autorises = await agentsEvaluablesPar(clientId, campagne.id)
    if (!autorises.some((a) => a.id === agentId)) {
      return NextResponse.json({ error: 'Vous ne pouvez pas évaluer cet agent.' }, { status: 403 })
    }

    const dejaFait = await prisma.noteClient.findFirst({
      where: { clientId, agentId, campagneId: campagne.id },
      select: { id: true },
    })
    if (dejaFait) {
      return NextResponse.json({ error: 'Vous avez déjà donné votre avis sur cet agent.' }, { status: 409 })
    }

    const criteres = (
      await prisma.critere.findMany({
        where: { campagneId: campagne.id },
        select: { id: true, libelle: true, noteMaximale: true, typeEvaluateur: true, typeEvaluateurs: true },
      })
    ).filter(estClientExterne)

    // Chaque critère client doit recevoir exactement une note dans le barème.
    const parCritere = new Map(notes.map((n) => [n.critereId, n]))
    const lignes = []
    for (const c of criteres) {
      const n = parCritere.get(c.id)
      const valeur = Number(n?.valeur)
      if (!n || !Number.isInteger(valeur) || valeur < 1 || valeur > c.noteMaximale) {
        return NextResponse.json({ error: `Merci de noter « ${c.libelle} » (de 1 à ${c.noteMaximale}).` }, { status: 400 })
      }
      const commentaire = typeof n.commentaire === 'string' ? n.commentaire.trim().slice(0, 2000) : ''
      lignes.push({ critereId: c.id, valeur, commentaire: commentaire || null })
    }

    // L'empreinte IP est conservée à titre d'audit uniquement.
    const ipHash = createHash('sha256').update(`${clientIp(request.headers) ?? 'inconnue'}:${agentId}:${campagne.id}`).digest('hex')

    await prisma.$transaction([
      prisma.noteClient.createMany({
        data: lignes.map((l) => ({ ...l, agentId, campagneId: campagne.id, clientId, ipHash })),
      }),
      prisma.affectation.upsert({
        where: { evaluateurId_evalueId_campagneId: { evaluateurId: clientId, evalueId: agentId, campagneId: campagne.id } },
        update: { statut: 'TERMINEE' },
        create: { evaluateurId: clientId, evalueId: agentId, campagneId: campagne.id, statut: 'TERMINEE' },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('qr/submit error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de l’envoi de votre avis.' }, { status: 500 })
  }
}
