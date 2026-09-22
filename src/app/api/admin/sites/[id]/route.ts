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
    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        utilisateurs: true,
        _count: { select: { utilisateurs: true } }
      }
    })

    if (!site) {
      return NextResponse.json({ error: 'Site non trouvé' }, { status: 404 })
    }

    return NextResponse.json(site)
  } catch (error) {
    console.error('Error:', error)
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
    const { nom, ville } = await request.json()

    const site = await prisma.site.update({
      where: { id },
      data: { nom, ville }
    })

    return NextResponse.json(site)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
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

    // Dissocier les utilisateurs associés à ce site
    await prisma.utilisateur.updateMany({
      where: { siteId: id },
      data: { siteId: null }
    })

    // Supprimer le site
    await prisma.site.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Site supprimé avec succès' })
  } catch (error: any) {
    console.error('Error deleting site:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression: ' + (error?.message || 'Erreur serveur') }, { status: 500 })
  }
}
