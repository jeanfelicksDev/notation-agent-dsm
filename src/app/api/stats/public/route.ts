import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stats/public
 * Public route.
 * Returns real statistics for the landing page:
 * - Number of evaluated / participating agents
 * - Number of active campaigns
 * - Evaluation completion rate (%)
 * - Active campaign label
 */
export async function GET() {
  try {
    // 1. Find active campaign or the most recent one
    const activeCampaign = await prisma.campagne.findFirst({
      where: { statut: 'OUVERTE' },
      select: { id: true, libelle: true },
      orderBy: { createdAt: 'desc' },
    })

    const targetCampaign = activeCampaign || (await prisma.campagne.findFirst({
      select: { id: true, libelle: true },
      orderBy: { createdAt: 'desc' },
    }))

    // 2. Count active campaigns and total campaigns
    const [campagnesOuvertes, totalCampagnes, totalAgents] = await Promise.all([
      prisma.campagne.count({ where: { statut: 'OUVERTE' } }),
      prisma.campagne.count(),
      prisma.utilisateur.count({
        where: {
          role: { in: ['UTILISATEUR', 'MANAGER'] },
        },
      }),
    ])

    // 3. Count evaluated / assigned agents
    let agentsCount = 0
    let completionRate = 0

    if (targetCampaign) {
      // Find internal affectations for this campaign
      const [totalAffectations, termineesAffectations, distinctEvalues, distinctClientAgents] =
        await Promise.all([
          prisma.affectation.count({ where: { campagneId: targetCampaign.id } }),
          prisma.affectation.count({
            where: { campagneId: targetCampaign.id, statut: 'TERMINEE' },
          }),
          prisma.affectation.findMany({
            where: { campagneId: targetCampaign.id },
            distinct: ['evalueId'],
            select: { evalueId: true },
          }),
          prisma.noteClient.findMany({
            where: { campagneId: targetCampaign.id },
            distinct: ['agentId'],
            select: { agentId: true },
          }),
        ])

      const uniqueAgentIds = new Set([
        ...distinctEvalues.map((a) => a.evalueId),
        ...distinctClientAgents.map((nc) => nc.agentId),
      ])

      // If agents have been assigned/evaluated in this campaign, use that count; otherwise fallback to total eligible agents
      agentsCount = uniqueAgentIds.size > 0 ? uniqueAgentIds.size : totalAgents

      if (totalAffectations > 0) {
        completionRate = Math.round((termineesAffectations / totalAffectations) * 100)
      }
    } else {
      // No campaign yet: show registered agents count
      agentsCount = totalAgents
    }

    return NextResponse.json({
      agentsCount,
      campagnesCount: campagnesOuvertes > 0 ? campagnesOuvertes : totalCampagnes,
      completionRate,
      campaignLabel: targetCampaign?.libelle || null,
      isActiveCampaign: !!activeCampaign,
    })
  } catch (error) {
    console.error('Error fetching public stats:', error)
    return NextResponse.json(
      {
        agentsCount: 0,
        campagnesCount: 0,
        completionRate: 0,
        campaignLabel: null,
        isActiveCampaign: false,
      },
      { status: 200 }
    )
  }
}
