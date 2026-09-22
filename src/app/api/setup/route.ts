import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    // Vérification de sécurité : nécessite soit une session ADMIN active, soit une clé secrète dans le header
    const setupSecret = process.env.SETUP_SECRET_KEY
    const providedSecret = req.headers.get('x-setup-key') || req.nextUrl.searchParams.get('key')
    
    const isAuthorizedBySecret = setupSecret && providedSecret === setupSecret
    const isAuthorizedBySession = Boolean(await requireAdmin())

    // En environnement de production, bloquer les accès non autorisés
    if (!isAuthorizedBySecret && !isAuthorizedBySession) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            error: 'Accès interdit. Pour initialiser le compte administrateur en production, utilisez la commande CLI "npm run admin:seed" ou fournissez l\'en-tête "x-setup-key".',
          },
          { status: 403 }
        )
      }
    }

    const body = await req.json().catch(() => ({}))
    const matricule = (body.matricule || '7453').toUpperCase().trim()
    const password = body.password || 'admin123'
    const email = (body.email || 'jeanfelicks11@gmail.com').toLowerCase().trim()
    const nom = body.nom || 'ZIAGOUE'
    const prenom = body.prenom || 'Jean-Félix'

    const adminPasswordHash = hashPassword(password)

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
    })

    if (existing) {
      await prisma.utilisateur.update({
        where: { id: existing.id },
        data: {
          matricule,
          email,
          motDePasse: adminPasswordHash,
          role: 'ADMIN',
          siteId: site.id,
        },
      })
      return NextResponse.json({
        success: true,
        message: `Compte Admin (${matricule}) mis à jour avec succès.`,
      })
    }

    await prisma.utilisateur.create({
      data: {
        matricule,
        nom,
        prenom,
        email,
        motDePasse: adminPasswordHash,
        role: 'ADMIN',
        siteId: site.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Compte Admin (${matricule}) créé avec succès.`,
    })
  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: error?.message || 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}