import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import prisma from '@/lib/prisma'
import { hashPassword, normalizeEmail, normalizeMatricule, requireAdmin } from '@/lib/auth'

function secretValide(fourni: string | null): boolean {
  const attendu = process.env.SETUP_SECRET_KEY
  if (!attendu || !fourni) return false
  const a = Buffer.from(attendu)
  const b = Buffer.from(fourni)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * POST /api/setup
 * Crée ou met à jour un compte administrateur.
 * Exige une session ADMIN, ou l'en-tête `x-setup-key` égal à SETUP_SECRET_KEY — dans tous les environnements.
 * Préférez la commande `npm run admin:seed`.
 */
export async function POST(req: NextRequest) {
  try {
    const autorise = secretValide(req.headers.get('x-setup-key')) || Boolean(await requireAdmin())
    if (!autorise) {
      return NextResponse.json({ error: 'Accès interdit.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const matricule = typeof body.matricule === 'string' ? normalizeMatricule(body.matricule) : ''
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
    const prenom = typeof body.prenom === 'string' ? body.prenom.trim() : ''

    if (!matricule || !email || !nom || !prenom) {
      return NextResponse.json({ error: 'matricule, email, nom et prenom sont requis.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe administrateur doit faire au moins 8 caractères.' }, { status: 400 })
    }

    const site = await prisma.site.upsert({
      where: { nom: 'Siège Social' },
      update: {},
      create: { nom: 'Siège Social', ville: 'Abidjan' },
    })

    const existing = await prisma.utilisateur.findFirst({
      where: {
        OR: [
          { matricule: { equals: matricule, mode: 'insensitive' } },
          { email: { equals: email, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })

    const data = {
      matricule,
      email,
      nom,
      prenom,
      motDePasse: hashPassword(password),
      role: 'ADMIN' as const,
      siteId: site.id,
      tentativesEchouees: 0,
      verrouilleJusqua: null,
    }

    if (existing) {
      await prisma.utilisateur.update({ where: { id: existing.id }, data })
      return NextResponse.json({ success: true, message: `Compte administrateur ${matricule} mis à jour.` })
    }

    await prisma.utilisateur.create({ data })
    return NextResponse.json({ success: true, message: `Compte administrateur ${matricule} créé.` })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
