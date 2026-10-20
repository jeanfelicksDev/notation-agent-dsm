import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { chargerListes } from '@/lib/listes-serveur'
import { estListeLibre, memeLibelle, TITRES_LISTES } from '@/lib/listes'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    return NextResponse.json(await chargerListes())
  } catch (error) {
    console.error('API GET Error [listes]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** Ajoute une valeur à une liste libre (les rôles ne s'ajoutent pas). */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const libelle = typeof body?.libelle === 'string' ? body.libelle.trim().replace(/\s+/g, ' ') : ''
  if (!estListeLibre(body?.liste)) {
    return NextResponse.json({ error: 'Cette liste ne peut pas recevoir de nouvelle valeur.' }, { status: 400 })
  }
  if (!libelle || libelle.length > 120) {
    return NextResponse.json({ error: 'Saisissez une valeur (120 caractères au plus).' }, { status: 400 })
  }

  try {
    const existantes = await prisma.valeurListe.findMany({ where: { liste: body.liste }, select: { libelle: true } })
    const doublon = existantes.find((v) => memeLibelle(v.libelle, libelle))
    if (doublon) {
      return NextResponse.json({ error: `« ${doublon.libelle} » figure déjà dans la liste.` }, { status: 409 })
    }
    await prisma.valeurListe.create({ data: { liste: body.liste, libelle } })
    return NextResponse.json({ listes: await chargerListes(), message: `« ${libelle} » ajouté aux ${TITRES_LISTES[body.liste as keyof typeof TITRES_LISTES].toLowerCase()}.` })
  } catch (error) {
    console.error('API POST Error [listes]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
