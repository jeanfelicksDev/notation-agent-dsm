import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    const affectations = await prisma.affectation.findMany({
      where: { campagneId: id }
    })
    return NextResponse.json(affectations)
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement des affectations' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const { mode, evaluateurId, evalueId, evalueIds, evaluateurIds, autoGenerate } = body

    // 1. Auto-génération TAMIS globale
    if (autoGenerate) {
      const allUsers = await prisma.utilisateur.findMany({
        include: { site: true }
      })

      const newAffectationsData: { campagneId: string; evaluateurId: string; evalueId: string }[] = []
      const existingKeys = new Set<string>()

      // Seuls les agents opérationnels (non managers, non externes, non admins) sont notés
      const evalueUsers = allUsers.filter(u => u.role !== 'MANAGER' && u.role !== 'EXTERNE' && u.role !== 'ADMIN')
      const managerUsers = allUsers.filter(u => u.role === 'MANAGER')

      for (const user of evalueUsers) {
        // A. Assigner les collègues (pairs) du même service
        if (user.service) {
          const sameServicePeers = allUsers.filter(u => u.service === user.service && u.id !== user.id && u.role !== 'MANAGER' && u.role !== 'EXTERNE' && u.role !== 'ADMIN')
          for (const peer of sameServicePeers) {
            const key = `${peer.id}_${user.id}`
            if (!existingKeys.has(key)) {
              existingKeys.add(key)
              newAffectationsData.push({ campagneId: id, evaluateurId: peer.id, evalueId: user.id })
            }
          }
        }

        // B. Assigner les Managers (du même service, même département ou même site)
        const relevantManagers = managerUsers.filter(m => 
          (user.departement && m.departement === user.departement) ||
          (user.service && m.service === user.service) ||
          (user.siteId && m.siteId === user.siteId)
        )
        for (const mgr of relevantManagers) {
          if (mgr.id !== user.id) {
            const key = `${mgr.id}_${user.id}`
            if (!existingKeys.has(key)) {
              existingKeys.add(key)
              newAffectationsData.push({ campagneId: id, evaluateurId: mgr.id, evalueId: user.id })
            }
          }
        }
      }

      if (newAffectationsData.length > 0) {
        await prisma.affectation.createMany({
          data: newAffectationsData,
          skipDuplicates: true
        })
      }

      return NextResponse.json({ success: true, count: newAffectationsData.length })
    }

    // 2. Mode PAR COLLABORATEUR (Évalué) : attribuer à `evalueId` la liste `evaluateurIds`
    if (mode === 'by_evalue' || (evalueId && Array.isArray(evaluateurIds))) {
      if (!evalueId || !Array.isArray(evaluateurIds)) {
        return NextResponse.json({ error: 'Données invalides pour le mode collaborateur' }, { status: 400 })
      }

      // Règle stricte : interdire l'auto-évaluation
      const cleanEvaluateurIds = evaluateurIds.filter((evalId: string) => evalId && evalId !== evalueId)

      await prisma.$transaction([
        prisma.affectation.deleteMany({
          where: {
            campagneId: id,
            evalueId: evalueId
          }
        }),
        ...cleanEvaluateurIds.map((evalId: string) =>
          prisma.affectation.create({
            data: {
              campagneId: id,
              evaluateurId: evalId,
              evalueId: evalueId
            }
          })
        )
      ])

      return NextResponse.json({ success: true })
    }

    // 3. Mode PAR ÉVALUATEUR (Notant) : attribuer à `evaluateurId` la liste `evalueIds`
    if (!evaluateurId || !Array.isArray(evalueIds)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    // Règle stricte : interdire l'auto-évaluation
    const cleanEvalueIds = evalueIds.filter((targetId: string) => targetId && targetId !== evaluateurId)

    await prisma.$transaction([
      prisma.affectation.deleteMany({
        where: {
          campagneId: id,
          evaluateurId: evaluateurId
        }
      }),
      ...cleanEvalueIds.map((targetId: string) =>
        prisma.affectation.create({
          data: {
            campagneId: id,
            evaluateurId: evaluateurId,
            evalueId: targetId
          }
        })
      )
    ])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Affectation error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour des affectations' }, { status: 500 })
  }
}
