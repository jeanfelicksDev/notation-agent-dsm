import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { construireFicheRetours } from '@/lib/commentaires'
import { campagneDesRetours, notesSoumisesParNote } from '@/lib/retours-serveur'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/retours/[userId]?campagneId= — fiche de retours anonymisée d'un collaborateur.
 * Aucune information sur les auteurs ne quitte le serveur : ni nom, ni identifiant, ni date.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { userId } = await params
    const campagne = await campagneDesRetours(new URL(request.url).searchParams.get('campagneId'))
    if (!campagne) return NextResponse.json({ error: 'Aucune campagne trouvée' }, { status: 404 })

    const agent = await prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { prenom: true, nom: true, matricule: true, service: true, emploi: true },
    })
    if (!agent) return NextResponse.json({ error: 'Collaborateur introuvable' }, { status: 404 })

    const parNote = await notesSoumisesParNote(campagne.id, userId)
    const fiche = construireFicheRetours(parNote.get(userId) ?? [])

    return NextResponse.json({ campagne, agent, fiche })
  } catch (error) {
    console.error('admin/retours/[userId] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
