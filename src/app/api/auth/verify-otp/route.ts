import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  createSession,
  normalizeMatricule,
  verifyOtpCode,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Corps de requête invalide' },
        { status: 400 }
      )
    }

    const rawMatricule = typeof body.matricule === 'string' ? body.matricule : ''
    const rawCode = typeof body.code === 'string' ? body.code : ''

    if (!rawMatricule.trim() || !/^\d{6}$/.test(rawCode.trim())) {
      return NextResponse.json(
        { error: 'Matricule et code à 6 chiffres requis' },
        { status: 400 }
      )
    }

    const matricule = normalizeMatricule(rawMatricule)
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { matricule },
      select: { id: true, role: true },
    })

    if (!utilisateur) {
      return NextResponse.json(
        { error: 'Matricule ou code incorrect' },
        { status: 401 }
      )
    }

    const result = await verifyOtpCode(utilisateur.id, rawCode.trim())
    if (!result.ok) {
      const message =
        result.reason === 'expired'
          ? 'Code expiré, demandez-en un nouveau'
          : result.reason === 'too_many_attempts'
            ? 'Trop de tentatives, demandez un nouveau code'
            : result.reason === 'not_found'
              ? 'Aucun code en attente, demandez-en un nouveau'
              : 'Code incorrect'
      return NextResponse.json({ error: message }, { status: 401 })
    }

    const userAgent = request.headers.get('user-agent')
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    await createSession(utilisateur.id, userAgent, ip)

    return NextResponse.json({ success: true, role: utilisateur.role })
  } catch (error) {
    console.error('verify-otp error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
