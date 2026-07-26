import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  createSession,
  hashPassword,
  normalizeEmail,
  normalizeMatricule,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { rawMatricule, rawEmail, password, confirmPassword } = body

    const matriculeInput = typeof rawMatricule === 'string' ? rawMatricule : typeof body.matricule === 'string' ? body.matricule : ''
    const emailInput = typeof rawEmail === 'string' ? rawEmail : typeof body.email === 'string' ? body.email : ''
    const passInput = typeof password === 'string' ? password : ''
    const confirmInput = typeof confirmPassword === 'string' ? confirmPassword : ''

    if (!matriculeInput.trim()) {
      return NextResponse.json({ error: 'Le matricule est obligatoire' }, { status: 400 })
    }
    if (!emailInput.trim()) {
      return NextResponse.json({ error: 'L’adresse email est obligatoire' }, { status: 400 })
    }
    if (!passInput) {
      return NextResponse.json({ error: 'Le mot de passe est obligatoire' }, { status: 400 })
    }
    if (passInput !== confirmInput) {
      return NextResponse.json(
        { error: 'Les mots de passe ne correspondent pas' },
        { status: 400 }
      )
    }
    if (passInput.length < 4) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 4 caractères' },
        { status: 400 }
      )
    }

    const matricule = normalizeMatricule(matriculeInput)
    const email = normalizeEmail(emailInput)
    const hashedPassword = hashPassword(passInput)

    // Vérifier si le matricule existe déjà
    let utilisateur = await prisma.utilisateur.findUnique({
      where: { matricule },
    })

    if (utilisateur) {
      // Si l'utilisateur est déjà enregistré avec cet email et a changé son mdp
      // On met à jour son compte avec le mot de passe et l'email
      utilisateur = await prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: {
          email,
          motDePasse: hashedPassword,
        },
      })
    } else {
      // Sinon on le crée
      utilisateur = await prisma.utilisateur.create({
        data: {
          matricule,
          email,
          motDePasse: hashedPassword,
          nom: matricule,
          prenom: 'Agent',
          role: 'UTILISATEUR',
        },
      })
    }

    // Créer la session automatiquement pour connecter l'utilisateur
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
    console.error('Register error:', error)
    if (
      error?.code === 'P2002' ||
      error?.message?.includes('P2002') ||
      error?.message?.includes('Unique constraint')
    ) {
      return NextResponse.json(
        { error: 'Ce matricule ou cet email est déjà utilisé. Essayez de vous connecter dans l’onglet "Se connecter".' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur lors de la création du compte' },
      { status: 500 }
    )
  }
}
