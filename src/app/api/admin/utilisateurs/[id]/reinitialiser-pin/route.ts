import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

/**
 * POST /api/admin/utilisateurs/[id]/reinitialiser-pin
 * Efface le PIN de l'agent et ferme ses sessions : il en choisira un nouveau à sa prochaine connexion.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const cible = await prisma.utilisateur.findUnique({ where: { id }, select: { role: true } })
  if (!cible) return NextResponse.json({ error: 'Agent introuvable' }, { status: 404 })
  if (cible.role === 'ADMIN') {
    return NextResponse.json(
      { error: "Le mot de passe d'un administrateur se modifie depuis sa fiche, pas par réinitialisation." },
      { status: 400 }
    )
  }

  await prisma.$transaction([
    prisma.utilisateur.update({
      where: { id },
      data: { motDePasse: '', tentativesEchouees: 0, verrouilleJusqua: null },
    }),
    prisma.session.deleteMany({ where: { utilisateurId: id } }),
  ])

  return NextResponse.json({ success: true })
}
