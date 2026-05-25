import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  createOtpToken,
  generateOtpCode,
  normalizeEmail,
  normalizeMatricule,
} from '@/lib/auth'
import { sendOtpEmail } from '@/lib/email'

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
    const rawEmail = typeof body.email === 'string' ? body.email : ''

    if (!rawMatricule.trim() || !rawEmail.trim()) {
      return NextResponse.json(
        { error: 'Matricule et email requis' },
        { status: 400 }
      )
    }

    const matricule = normalizeMatricule(rawMatricule)
    const email = normalizeEmail(rawEmail)

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { matricule },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
      },
    })

    if (!utilisateur) {
      // Réponse volontairement générique pour ne pas révéler quels matricules existent
      return NextResponse.json(
        { error: 'Matricule ou email incorrect' },
        { status: 401 }
      )
    }

    // 1ère connexion : si l'utilisateur n'a pas encore d'email réel enregistré
    // (placeholder fréquent : <matricule>@dsm.local), on accepte celui qu'il saisit
    // et on le persiste. Sinon il doit correspondre exactement.
    const storedEmail = utilisateur.email.toLowerCase()
    const isPlaceholder = storedEmail.endsWith('@dsm.local') || storedEmail === 'admin@dsm.ci' || storedEmail === ''

    if (!isPlaceholder && storedEmail !== email) {
      return NextResponse.json(
        { error: 'Matricule ou email incorrect' },
        { status: 401 }
      )
    }

    if (isPlaceholder) {
      // On vérifie qu'un autre employé n'a pas déjà cet email
      const existing = await prisma.utilisateur.findUnique({
        where: { email },
        select: { id: true },
      })
      if (existing && existing.id !== utilisateur.id) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé par un autre compte' },
          { status: 409 }
        )
      }
      await prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: { email },
      })
    }

    const code = generateOtpCode()
    await createOtpToken(utilisateur.id, code)

    const sendRes = await sendOtpEmail(
      email,
      code,
      `${utilisateur.prenom} ${utilisateur.nom}`
    )

    if (!sendRes.success) {
      return NextResponse.json(
        { error: 'Impossible d\'envoyer le code par email pour le moment' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      channel: sendRes.channel,
      // Indice masqué pour l'utilisateur — confirme qu'on a bien envoyé au bon endroit
      emailMasked: maskEmail(email),
    })
  } catch (error) {
    console.error('send-otp error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`
}
