import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { construireFicheRetours } from '@/lib/commentaires'
import { campagneDesRetours, notesSoumisesParNote } from '@/lib/retours-serveur'

export const dynamic = 'force-dynamic'

/** GET /api/admin/retours?campagneId= — collaborateurs notés et volume de leurs retours anonymisés. */
export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const campagne = await campagneDesRetours(new URL(request.url).searchParams.get('campagneId'))
    const campagnes = await prisma.campagne.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, libelle: true, statut: true },
    })
    if (!campagne) return NextResponse.json({ campagne: null, campagnes, agents: [] })

    const parNote = await notesSoumisesParNote(campagne.id)
    const utilisateurs = await prisma.utilisateur.findMany({
      where: { id: { in: [...parNote.keys()] } },
      select: { id: true, prenom: true, nom: true, matricule: true, service: true },
    })

    const agents = utilisateurs
      .map((u) => {
        const fiche = construireFicheRetours(parNote.get(u.id) ?? [])
        const visibles = fiche.totaux.reproche + fiche.totaux.neutre + fiche.totaux.point_fort
        return { ...u, totaux: fiche.totaux, visibles, masques: fiche.masques }
      })
      .sort((a, b) => b.totaux.reproche - a.totaux.reproche || a.nom.localeCompare(b.nom, 'fr'))

    return NextResponse.json({ campagne, campagnes, agents })
  } catch (error) {
    console.error('admin/retours error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
