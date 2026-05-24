import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const utilisateurs = await prisma.utilisateur.findMany({
      include: { site: true },
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
    const { matricule, nom, prenom, email, motDePasse, role, service, siteId, managerId } = await request.json()

    if (!matricule || !nom || !prenom || !email || !motDePasse) {
      return NextResponse.json({ error: 'Tous les champs obligatoires doivent être remplis' }, { status: 400 })
    }

    const utilisateur = await prisma.utilisateur.create({
      data: {
        matricule: matricule.toUpperCase(),
        nom,
        prenom,
        email,
        motDePasse,
        role: role || 'UTILISATEUR',
        service,
        siteId,
        managerId
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