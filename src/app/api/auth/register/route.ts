import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  createSession,
  hashPassword,
  normalizeMatricule,
  verifyOtpCode,
} from '@/lib/auth'

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/[-()+]/g, '')
}

/**
 * POST /api/auth/register
 * Validates registration with matricule/telephone and 4-digit password.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { matricule: rawMatricule, password } = body

    const matriculeInput = typeof rawMatricule === 'string' ? rawMatricule.trim() : ''
    const passInput = typeof password === 'string' ? password.trim() : ''

    if (!matriculeInput) {
      return NextResponse.json({ error: 'Le matricule ou numéro de téléphone est obligatoire' }, { status: 400 })
    }
    if (!passInput) {
      return NextResponse.json({ error: 'Le mot de passe est obligatoire' }, { status: 400 })
    }
    if (!/^\d{4}$/.test(passInput)) {
      return NextResponse.json(
        { error: 'Le mot de passe doit comporter exactement 4 chiffres' },
        { status: 400 }
      )
    }

    const matricule = normalizeMatricule(matriculeInput)
    const cleanPhone = normalizePhone(matriculeInput)

    // Trouver l'utilisateur pré-inscrit par matricule, email ou téléphone
    let utilisateur = await prisma.utilisateur.findFirst({
      where: {
        OR: [
          { matricule: { equals: matricule, mode: 'insensitive' } },
          { email: { equals: matriculeInput.toLowerCase(), mode: 'insensitive' } },
          { telephone: { equals: matriculeInput, mode: 'insensitive' } },
        ],
      },
    })

    if (!utilisateur && cleanPhone.length >= 4) {
      const candidates = await prisma.utilisateur.findMany({
        where: { telephone: { not: null } },
      })
      utilisateur = candidates.find((u) => {
        if (!u.telephone) return false
        const uPhoneClean = normalizePhone(u.telephone)
        return (
          uPhoneClean === cleanPhone ||
          uPhoneClean.endsWith(cleanPhone) ||
          cleanPhone.endsWith(uPhoneClean)
        )
      }) || null
    }

    if (!utilisateur) {
      return NextResponse.json(
        { error: 'Ce matricule ou numéro de téléphone n’est pas pré-inscrit dans la base. Veuillez contacter l’administrateur.' },
        { status: 404 }
      )
    }

    // Hasher le mot de passe à 4 chiffres et enregistrer
    const hashedPassword = hashPassword(passInput)
    const updatedUser = await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        motDePasse: hashedPassword,
      },
    })

    // Créer la session pour connecter automatiquement l'agent
    const userAgent = request.headers.get('user-agent')
    const ipAddress = request.headers.get('x-forwarded-for') || null
    await createSession(updatedUser.id, userAgent, ipAddress)

    return NextResponse.json({
      success: true,
      role: updatedUser.role,
      user: {
        id: updatedUser.id,
        matricule: updatedUser.matricule,
        nom: updatedUser.nom,
        prenom: updatedUser.prenom,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    })
  } catch (error: any) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur lors de la création du compte' },
      { status: 500 }
    )
  }
}
