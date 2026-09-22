import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { normalizeMatricule } from '@/lib/auth'

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/[-()+]/g, '')
}

/**
 * POST /api/auth/register/check-matricule
 * Public route.
 * Checks if a given matricule/telephone has already completed registration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.matricule !== 'string') {
      return NextResponse.json({ error: 'Matricule ou téléphone requis' }, { status: 400 })
    }

    const rawMatricule = body.matricule.trim()
    if (!rawMatricule) {
      return NextResponse.json({ isRegistered: false })
    }

    const matricule = normalizeMatricule(rawMatricule)
    const cleanPhone = normalizePhone(rawMatricule)

    let user = await prisma.utilisateur.findFirst({
      where: {
        OR: [
          { matricule: { equals: matricule, mode: 'insensitive' } },
          { email: { equals: rawMatricule.toLowerCase(), mode: 'insensitive' } },
          { telephone: { equals: rawMatricule, mode: 'insensitive' } },
        ],
      },
      select: { id: true, motDePasse: true, nom: true, prenom: true, matricule: true, telephone: true },
    })

    if (!user && cleanPhone.length >= 4) {
      const candidates = await prisma.utilisateur.findMany({
        where: { telephone: { not: null } },
        select: { id: true, motDePasse: true, nom: true, prenom: true, matricule: true, telephone: true },
      })
      user = candidates.find((u) => {
        if (!u.telephone) return false
        const uPhoneClean = normalizePhone(u.telephone)
        return (
          uPhoneClean === cleanPhone ||
          uPhoneClean.endsWith(cleanPhone) ||
          cleanPhone.endsWith(uPhoneClean)
        )
      }) || null
    }

    if (!user) {
      return NextResponse.json({ exists: false, isRegistered: false, error: 'Matricule ou Téléphone inconnu' })
    }

    // A user is registered if their password is in hashed format or explicitly set
    const isRegistered = Boolean(user.motDePasse && (user.motDePasse.startsWith('scrypt:') || user.motDePasse.startsWith('salt_dsm_') || user.motDePasse.length > 0))

    return NextResponse.json({
      exists: true,
      isRegistered,
      matricule: user.matricule,
      userName: `${user.prenom || ''} ${user.nom || ''}`.trim()
    })
  } catch (error) {
    console.error('Check matricule error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

