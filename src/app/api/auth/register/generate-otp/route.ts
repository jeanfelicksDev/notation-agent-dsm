import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateOtpCode, createOtpToken, normalizeMatricule } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/email'

/**
 * POST /api/auth/register/generate-otp
 * Generates a 6-digit OTP code for the given matricule during registration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.matricule !== 'string') {
      return NextResponse.json({ error: 'Matricule requis' }, { status: 400 })
    }

    const rawMatricule = body.matricule.trim()
    if (!rawMatricule) {
      return NextResponse.json({ error: 'Le matricule est obligatoire' }, { status: 400 })
    }

    const matricule = normalizeMatricule(rawMatricule)

    // Find user
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { matricule },
    })

    if (!utilisateur) {
      return NextResponse.json(
        { error: 'Ce matricule n’est pas pré-inscrit dans la base de données. Veuillez contacter l’administrateur.' },
        { status: 404 }
      )
    }

    // Generate code and persist OTP token
    const code = generateOtpCode()
    await createOtpToken(utilisateur.id, code)

    if (utilisateur.email) {
      await sendOtpEmail(utilisateur.email, code, `${utilisateur.prenom} ${utilisateur.nom}`).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      message: 'Code OTP généré avec succès.',
      code,
    })
  } catch (error: any) {
    console.error('Generate OTP error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la génération de l’OTP' }, { status: 500 })
  }
}
