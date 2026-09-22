import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

/**
 * POST /api/admin/utilisateurs/generate-qr
 * Admin only.
 * Generates qrToken for all users whose qrcodeActif is true (and missing qrToken),
 * or for specific userIds if provided.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const { userIds, forceRegenerate, enableAllAgents } = body

    if (enableAllAgents) {
      // Enable qrcodeActif for all non-admin agents
      await prisma.utilisateur.updateMany({
        where: { role: { not: 'ADMIN' } },
        data: { qrcodeActif: true }
      })
    }

    // Find users with qrcodeActif: true
    const whereClause: any = { qrcodeActif: true }
    if (Array.isArray(userIds) && userIds.length > 0) {
      whereClause.id = { in: userIds }
    } else if (!forceRegenerate) {
      // Only those missing qrToken
      whereClause.OR = [
        { qrToken: null },
        { qrToken: '' }
      ]
    }

    const targetUsers = await prisma.utilisateur.findMany({
      where: whereClause,
      select: { id: true, matricule: true, nom: true, prenom: true, qrToken: true }
    })

    let generatedCount = 0
    for (const user of targetUsers) {
      if (!user.qrToken || forceRegenerate) {
        const token = randomBytes(20).toString('hex')
        await prisma.utilisateur.update({
          where: { id: user.id },
          data: { qrToken: token }
        })
        generatedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${generatedCount} code(s) QR généré(s) avec succès.`,
      generatedCount,
      totalActive: targetUsers.length
    })
  } catch (error: any) {
    console.error('Error generating QR codes:', error)
    return NextResponse.json({ error: 'Erreur lors de la génération des codes QR: ' + error.message }, { status: 500 })
  }
}
