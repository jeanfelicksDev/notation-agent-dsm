import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin, hashPassword } from '@/lib/auth'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const utilisateurs = await prisma.utilisateur.findMany({
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        service: true,
        departement: true,
        direction: true,
        siteId: true,
        qrcodeActif: true,
        qrToken: true,
        createdAt: true,
        site: {
          select: {
            id: true,
            nom: true,
            ville: true,
          }
        },
      },
      orderBy: { nom: 'asc' }
    })
    return NextResponse.json(utilisateurs)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { matricule, nom, prenom, email, motDePasse, role, service, departement, direction, siteId, qrcodeActif } = await request.json()

    if (!matricule || !nom || !prenom || !email || !motDePasse) {
      return NextResponse.json({ error: 'Tous les champs obligatoires doivent être remplis' }, { status: 400 })
    }

    const isQrActive = Boolean(qrcodeActif)
    let qrToken = undefined
    if (isQrActive) {
      const { randomBytes } = await import('node:crypto')
      qrToken = randomBytes(20).toString('hex')
    }

    const utilisateur = await prisma.utilisateur.create({
      data: {
        matricule: matricule.toUpperCase(),
        nom,
        prenom,
        email,
        motDePasse: hashPassword(motDePasse.trim()),
        role: role || 'UTILISATEUR',
        service,
        departement,
        direction,
        ...(siteId ? { site: { connect: { id: siteId } } } : {}),
        qrcodeActif: isQrActive,
        qrToken,
      }
    })

    return NextResponse.json(utilisateur)
  } catch (error: any) {
    console.error('Error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Matricule ou email déjà utilisé' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE() {
  const admin = await requireAdmin()
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Action réservée exclusivement aux administrateurs' }, { status: 403 })
  }

  try {
    const result = await prisma.utilisateur.deleteMany({
      where: {
        role: { not: 'ADMIN' },
        id: { not: admin.id } // Just in case, do not delete the active administrator
      }
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Error clearing participants:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression des participants' }, { status: 500 })
  }
}