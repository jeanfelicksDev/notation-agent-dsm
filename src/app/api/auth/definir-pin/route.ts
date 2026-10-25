import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { clientIp, createSession, hashPassword, pinEstDefini } from '@/lib/auth'
import { trouverParIdentifiant } from '@/lib/identifiant'
import { estHorsCampagne, MESSAGE_HORS_CAMPAGNE } from '@/lib/roles'

/**
 * POST /api/auth/definir-pin
 * Première connexion uniquement : l'agent choisit son PIN à 4 chiffres.
 * Si un PIN existe déjà, la requête est refusée — seul un administrateur peut le réinitialiser.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const saisie = typeof body?.identifiant === 'string' ? body.identifiant : ''
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''
    const confirmation = typeof body?.confirmation === 'string' ? body.confirmation.trim() : ''

    if (!saisie.trim()) {
      return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 })
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Le PIN doit comporter exactement 4 chiffres.' }, { status: 400 })
    }
    if (pin !== confirmation) {
      return NextResponse.json({ error: 'Les deux PIN saisis ne correspondent pas.' }, { status: 400 })
    }
    if (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '4321') {
      return NextResponse.json({ error: 'Ce PIN est trop facile à deviner. Choisissez-en un autre.' }, { status: 400 })
    }

    const utilisateur = await trouverParIdentifiant(saisie, { id: true, role: true, motDePasse: true })
    if (!utilisateur) {
      return NextResponse.json({ error: 'Identifiant inconnu.' }, { status: 404 })
    }
    if (utilisateur.role === 'ADMIN') {
      return NextResponse.json({ error: "Les comptes administrateur ne s'initialisent pas ici." }, { status: 403 })
    }
    if (estHorsCampagne(utilisateur.role)) {
      return NextResponse.json({ error: MESSAGE_HORS_CAMPAGNE }, { status: 403 })
    }

    const dejaDefini = NextResponse.json(
      { error: "Un PIN a déjà été défini pour ce compte. Connectez-vous, ou demandez une réinitialisation à l'administrateur." },
      { status: 409 }
    )
    if (pinEstDefini(utilisateur.motDePasse)) return dejaDefini

    // Écriture conditionnelle : si deux requêtes arrivent en même temps, une seule définit le PIN.
    const { count } = await prisma.utilisateur.updateMany({
      where: { id: utilisateur.id, motDePasse: utilisateur.motDePasse },
      data: { motDePasse: hashPassword(pin), tentativesEchouees: 0, verrouilleJusqua: null },
    })
    if (count === 0) return dejaDefini

    await createSession(utilisateur.id, request.headers.get('user-agent'), clientIp(request.headers))
    return NextResponse.json({ success: true, role: utilisateur.role })
  } catch (error) {
    console.error('definir-pin error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
