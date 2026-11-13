import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getFullClassementData } from '@/lib/classement'
import { enregistrerScores } from '@/lib/scores'
import { compterSituations } from '@/lib/eligibilite'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const campagneId = request.nextUrl.searchParams.get('campagneId') || undefined
    return NextResponse.json(await getFullClassementData(campagneId), { headers: NO_STORE })
  } catch (error) {
    console.error('GET /api/admin/classement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/admin/classement — enregistre le classement d'une campagne.
 * Une campagne clôturée passe à CALCULEE ; une campagne ouverte garde son statut.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json().catch(() => null)
    const campagneId = typeof body?.campagneId === 'string' ? body.campagneId : ''
    const campagne = campagneId ? await prisma.campagne.findUnique({ where: { id: campagneId } }) : null
    if (!campagne) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    const scores = await enregistrerScores(campagne.id)
    if (campagne.statut === 'CLOTUREE') {
      await prisma.campagne.update({ where: { id: campagne.id }, data: { statut: 'CALCULEE' } })
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Classement recalculé et enregistré.',
        bilan: compterSituations(scores),
        ...(await getFullClassementData(campagne.id)),
      },
      { headers: NO_STORE }
    )
  } catch (error) {
    console.error('POST /api/admin/classement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
