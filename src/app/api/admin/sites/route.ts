import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { codePrisma } from '@/lib/erreurs'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const sites = await prisma.site.findMany({
      include: {
        _count: { select: { utilisateurs: true } }
      },
      orderBy: { nom: 'asc' }
    })
    return NextResponse.json(sites)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    const ville = typeof body.ville === 'string' && body.ville.trim() ? body.ville.trim() : null

    if (!nom) {
      return NextResponse.json({ error: 'Le nom du site est requis' }, { status: 400 })
    }

    const site = await prisma.site.create({
      data: { nom, ville }
    })

    return NextResponse.json(site)
  } catch (error) {
    console.error('Error:', error)
    if (codePrisma(error) === 'P2002') {
      return NextResponse.json({ error: 'Un site porte déjà ce nom.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
