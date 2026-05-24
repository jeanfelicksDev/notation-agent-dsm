import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id },
      include: { 
        site: true, 
        manager: true, 
        subordonnes: true 
      }
    })

    if (!utilisateur) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json(utilisateur)
  } catch (error) {
    console.error('API GET Error [utilisateurs/[id]]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const { matricule, nom, prenom, email, telephone, role, siteId, managerId } = await request.json()

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data: {
        matricule: matricule?.toUpperCase(),
        nom,
        prenom,
        email: email ? String(email).toLowerCase().trim() : undefined,
        telephone: telephone ? String(telephone).trim() : null,
        role,
        siteId: siteId || null,
        managerId: managerId || null
      }
    })

    return NextResponse.json(utilisateur)
  } catch (error: any) {
    console.error('API PATCH Error [utilisateurs/[id]]:', error)
    const msg = error?.message || 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.utilisateur.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Utilisateur supprimé avec succès' })
  } catch (error) {
    console.error('API DELETE Error [utilisateurs/[id]]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
