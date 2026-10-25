import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  clientIp,
  compteVerrouille,
  createSession,
  enregistrerEchec,
  hashPassword,
  verifyPassword,
} from '@/lib/auth'
import { trouverParIdentifiant } from '@/lib/identifiant'
import { estHorsCampagne, MESSAGE_HORS_CAMPAGNE } from '@/lib/roles'

const ERREUR_GENERIQUE = 'Identifiant ou PIN incorrect.'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const saisie = typeof body?.identifiant === 'string' ? body.identifiant : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!saisie.trim() || !password) {
      return NextResponse.json({ error: 'Identifiant et PIN requis.' }, { status: 400 })
    }

    const utilisateur = await trouverParIdentifiant(saisie, {
      id: true,
      role: true,
      motDePasse: true,
      tentativesEchouees: true,
      verrouilleJusqua: true,
    })
    if (!utilisateur) {
      return NextResponse.json({ error: ERREUR_GENERIQUE }, { status: 401 })
    }

    if (estHorsCampagne(utilisateur.role)) {
      return NextResponse.json({ error: MESSAGE_HORS_CAMPAGNE }, { status: 403 })
    }

    if (compteVerrouille(utilisateur.verrouilleJusqua)) {
      const minutes = Math.ceil((utilisateur.verrouilleJusqua!.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.` },
        { status: 429 }
      )
    }

    const { isValid, needsRehash } = verifyPassword(password, utilisateur.motDePasse)
    if (!isValid) {
      const { verrouille, restantes } = await enregistrerEchec(utilisateur.id, utilisateur.tentativesEchouees)
      const error = verrouille
        ? 'Trop de tentatives. Compte verrouillé pendant 15 minutes.'
        : restantes <= 2
          ? `${ERREUR_GENERIQUE} Encore ${restantes} essai${restantes > 1 ? 's' : ''} avant verrouillage.`
          : ERREUR_GENERIQUE
      return NextResponse.json({ error }, { status: verrouille ? 429 : 401 })
    }

    await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        tentativesEchouees: 0,
        verrouilleJusqua: null,
        ...(needsRehash ? { motDePasse: hashPassword(password) } : {}),
      },
    })

    await createSession(utilisateur.id, request.headers.get('user-agent'), clientIp(request.headers))
    return NextResponse.json({ success: true, role: utilisateur.role })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la connexion' }, { status: 500 })
  }
}
