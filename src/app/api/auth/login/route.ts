import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  createSession,
  hashPassword,
  normalizeMatricule,
  verifyPassword,
} from '@/lib/auth'

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/[-()+]/g, '')
}

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
        { error: 'Le matricule (ou téléphone / email) et le mot de passe sont requis' },
        { status: 400 }
      )
    }

    const cleanInput = matriculeInput.trim()
    const matricule = normalizeMatricule(cleanInput)
    const emailCandidate = cleanInput.toLowerCase()
    const cleanPhone = normalizePhone(cleanInput)

    // 1. Recherche par matricule exact, email exact, ou téléphone direct
    let utilisateur = await prisma.utilisateur.findFirst({
      where: {
        OR: [
          { matricule: { equals: matricule, mode: 'insensitive' } },
          { email: { equals: emailCandidate, mode: 'insensitive' } },
          { telephone: { equals: cleanInput, mode: 'insensitive' } },
        ],
      },
    })

    // 2. Recherche tolérante par numéro de téléphone nettoyé
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

    // 3. Recherche par matricule tolérant aux espaces/zéros
    if (!utilisateur && cleanPhone.length >= 1) {
      const allUsers = await prisma.utilisateur.findMany()
      utilisateur = allUsers.find((u) => {
        const uMatClean = normalizePhone(u.matricule)
        return uMatClean === cleanPhone
      }) || null
    }

    if (!utilisateur) {
      return NextResponse.json(
        { error: 'Matricule/Téléphone ou mot de passe incorrect.' },
        { status: 401 }
      )
    }

    const { isValid, needsRehash } = verifyPassword(passInput, utilisateur.motDePasse)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Matricule/Téléphone ou mot de passe incorrect.' },
        { status: 401 }
      )
    }

    // Mise à niveau transparente du hash vers scrypt sécurisé si nécessaire
    if (needsRehash) {
      try {
        const upgradedHash = hashPassword(passInput)
        await prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: { motDePasse: upgradedHash },
        })
      } catch (err) {
        console.warn('Could not upgrade password hash for user', utilisateur.id, err)
      }
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
