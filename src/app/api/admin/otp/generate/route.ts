import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin, generateOtpCode, createOtpToken, normalizeMatricule } from '@/lib/auth'

/**
 * POST /api/admin/otp/generate
 * Body: { matricule: string }
 * Génère un OTP pour un agent et le retourne directement à l'admin (sans email).
 * Réservé aux ADMIN et MANAGER.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const rawMatricule = typeof body.matricule === 'string' ? body.matricule : ''
    if (!rawMatricule.trim()) {
      return NextResponse.json({ error: 'Matricule requis' }, { status: 400 })
    }

    const matricule = normalizeMatricule(rawMatricule)
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { matricule },
      select: { id: true, nom: true, prenom: true, matricule: true, role: true },
    })

    if (!utilisateur) {
      return NextResponse.json({ error: 'Agent introuvable' }, { status: 404 })
    }

    const code = generateOtpCode()
    const token = await createOtpToken(utilisateur.id, code)

    return NextResponse.json({
      success: true,
      code,
      agent: {
        matricule: utilisateur.matricule,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
      },
      expiresAt: token.expiresAt,
    })
  } catch (error) {
    console.error('admin/otp/generate error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
