import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
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
    const { nom, ville } = await request.json()

    if (!nom) {
      return NextResponse.json({ error: 'Le nom du site est requis' }, { status: 400 })
    }

    const site = await prisma.site.create({
      data: { nom, ville }
    })

    return NextResponse.json(site)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}