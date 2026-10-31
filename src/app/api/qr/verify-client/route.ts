import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCampagneOuverte } from '@/lib/campagne'
import { agentsEvaluablesPar, identifierClientExterne } from '@/lib/client-qr'

/**
 * POST /api/qr/verify-client — route publique.
 * Identifie un client externe par son téléphone ou son adresse e-mail (le téléphone prime)
 * et renvoie les agents qu'il peut évaluer.
 * Seuls les comptes EXTERNE sont acceptés : c'est la même règle que pour la soumission.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    // « telephone » reste accepté pour les pages déjà ouvertes avant le passage à « identifiant »
    const brut = body?.identifiant ?? body?.telephone
    const saisie = typeof brut === 'string' ? brut.trim() : ''
    if (!saisie) {
      return NextResponse.json({ error: 'Saisissez votre numéro de téléphone ou votre adresse e-mail.' }, { status: 400 })
    }

    const campagne = await getCampagneOuverte()
    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne d’évaluation n’est ouverte en ce moment.' }, { status: 404 })
    }

    const identification = await identifierClientExterne(saisie)
    if (!identification.ok) {
      return NextResponse.json({ error: identification.erreur }, { status: identification.statut })
    }
    const { client } = identification

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
        emploi: a.emploi ?? null,
        hasRated: notes.has(a.id),
      })),
    })
  } catch (error) {
    console.error('qr/verify-client error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la vérification.' }, { status: 500 })
  }
}
