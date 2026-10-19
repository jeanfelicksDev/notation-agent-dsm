import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCampagneOuverte } from '@/lib/campagne'
import { agentsEvaluablesPar, trouverClientExterne } from '@/lib/client-qr'

/**
 * POST /api/qr/verify-client — route publique.
 * Identifie un client externe par son téléphone et renvoie les agents qu'il peut évaluer.
 * Seuls les comptes EXTERNE sont acceptés : c'est la même règle que pour la soumission.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const saisie = typeof body?.telephone === 'string' ? body.telephone.trim() : ''
    if (!saisie) {
      return NextResponse.json({ error: 'Le numéro de téléphone est obligatoire.' }, { status: 400 })
    }

    const campagne = await getCampagneOuverte()
    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne d’évaluation n’est ouverte en ce moment.' }, { status: 404 })
    }

    const client = await trouverClientExterne(saisie)
    if (!client) {
      return NextResponse.json(
        { error: 'Ce numéro n’est pas enregistré comme client. Vérifiez-le ou contactez votre interlocuteur DSM.' },
        { status: 404 }
      )
    }

    const [agents, dejaNotes] = await Promise.all([
      agentsEvaluablesPar(client.id, campagne.id),
      prisma.noteClient.findMany({
        where: { clientId: client.id, campagneId: campagne.id },
        distinct: ['agentId'],
        select: { agentId: true },
      }),
    ])
    const notes = new Set(dejaNotes.map((n) => n.agentId))

    return NextResponse.json({
      success: true,
      client,
      campagne: { id: campagne.id, libelle: campagne.libelle },
      agents: agents.map((a) => ({
        id: a.id,
        nom: a.nom,
        prenom: a.prenom,
        service: a.service,
        site: a.site?.nom ?? null,
        hasRated: notes.has(a.id),
      })),
    })
  } catch (error) {
    console.error('qr/verify-client error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la vérification.' }, { status: 500 })
  }
}
