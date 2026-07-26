import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  createSession,
  normalizeMatricule,
  verifyPassword,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { rawMatricule, password } = body

    const matriculeInput = typeof rawMatricule === 'string' ? rawMatricule : typeof body.matricule === 'string' ? body.matricule : ''
    const passInput = typeof password === 'string' ? password : ''

    if (!matriculeInput.trim() || !passInput) {
      return NextResponse.json(
        { error: 'Le matricule et le mot de passe sont requis' },
        { status: 400 }
      )
    }

    const matricule = normalizeMatricule(matriculeInput)

    // Rechercher l'utilisateur par son matricule ou son email
    const utilisateur = await prisma.utilisateur.findFirst({
      where: {
        OR: [
          { matricule },
          { email: matriculeInput.trim().toLowerCase() },
        ],
      },
    })

    if (!utilisateur) {
      return NextResponse.json(
        { error: 'Matricule ou mot de passe incorrect. Avez-vous créé votre compte ?' },
        { status: 401 }
      )
    }

    const isValidPassword = verifyPassword(passInput, utilisateur.motDePasse)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Matricule ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    // Créer la session pour connecter l'utilisateur
    const userAgent = request.headers.get('user-agent')
    const ipAddress = request.headers.get('x-forwarded-for') || null
    await createSession(utilisateur.id, userAgent, ipAddress)

    return NextResponse.json({
      success: true,
      role: utilisateur.role,
      user: {
        id: utilisateur.id,
        matricule: utilisateur.matricule,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur lors de la connexion' },
      { status: 500 }
    )
  }
}
