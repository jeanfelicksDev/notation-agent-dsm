import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

/**
 * POST /api/admin/utilisateurs/[id]/generate-qr
 * Admin only. Generates (or regenerates) the qrToken for an agent.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params

  const agent = await prisma.utilisateur.findUnique({
    where: { id },
    select: { id: true, qrcodeActif: true },
  })

  if (!agent) return NextResponse.json({ error: 'Agent introuvable' }, { status: 404 })
  if (!agent.qrcodeActif) {
    return NextResponse.json(
      { error: 'La notation par QR code n\'est pas activée pour cet agent.' },
      { status: 400 }
    )
  }

  const qrToken = randomBytes(20).toString('hex')

  const updated = await prisma.utilisateur.update({
    where: { id },
    data: { qrToken },
    select: { qrToken: true },
  })

  return NextResponse.json({ success: true, qrToken: updated.qrToken })
}
