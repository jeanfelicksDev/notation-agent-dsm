import { NextRequest, NextResponse } from 'next/server'
import { pinEstDefini } from '@/lib/auth'
import { trouverParIdentifiant } from '@/lib/identifiant'
import { estHorsCampagne, MESSAGE_HORS_CAMPAGNE } from '@/lib/roles'

/**
 * POST /api/auth/identifier
 * Première étape de connexion : indique si l'agent doit définir son PIN
 * ou se connecter avec celui qu'il a déjà choisi.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const saisie = typeof body?.identifiant === 'string' ? body.identifiant : ''
    if (!saisie.trim()) {
      return NextResponse.json({ error: 'Saisissez votre matricule ou votre numéro de téléphone.' }, { status: 400 })
    }

    const utilisateur = await trouverParIdentifiant(saisie, { role: true, motDePasse: true })
    if (!utilisateur) {
      return NextResponse.json(
        { error: "Identifiant inconnu. Vérifiez votre saisie ou contactez l'administrateur." },
        { status: 404 }
      )
    }

    if (estHorsCampagne(utilisateur.role)) {
      return NextResponse.json({ error: MESSAGE_HORS_CAMPAGNE }, { status: 403 })
    }

    if (pinEstDefini(utilisateur.motDePasse)) {
      return NextResponse.json({ etat: 'connexion', admin: utilisateur.role === 'ADMIN' })
    }

    // Un compte administrateur ne peut jamais être initialisé depuis la page publique.
    if (utilisateur.role === 'ADMIN') {
      return NextResponse.json({ etat: 'contact_admin' })
    }

    return NextResponse.json({ etat: 'pin_a_definir' })
  } catch (error) {
    console.error('identifier error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
