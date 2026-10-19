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
      const allUsers = await prisma.utilisateur.findMany()

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

        // B. Assigner les Managers (du même service ou du même département)
        const relevantManagers = managerUsers.filter(m => 
          (user.departement && m.departement === user.departement) ||
          (user.service && m.service === user.service)
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

    // 2. Mode PAR COLLABORATEUR (Évalué) : la liste `evaluateurIds` devient celle des évaluateurs de `evalueId`.
    if (mode === 'by_evalue' || (evalueId && Array.isArray(evaluateurIds))) {
      if (!evalueId || !Array.isArray(evaluateurIds)) {
        return NextResponse.json({ error: 'Données invalides pour le mode collaborateur' }, { status: 400 })
      }
      const resultat = await synchroniser(id, { evalueId }, 'evaluateurId', evaluateurIds, evalueId)
      return NextResponse.json({ success: true, ...resultat })
    }

    // 3. Mode PAR ÉVALUATEUR (Notant) : la liste `evalueIds` devient celle des collaborateurs notés par `evaluateurId`.
    if (!evaluateurId || !Array.isArray(evalueIds)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }
    const resultat = await synchroniser(id, { evaluateurId }, 'evalueId', evalueIds, evaluateurId)
    return NextResponse.json({ success: true, ...resultat })
  } catch (error) {
    console.error('Affectation error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour des affectations' }, { status: 500 })
  }
}

/**
 * Aligne les affectations sur la liste voulue SANS toucher à celles qui restent :
 * leur statut (brouillon, soumise) et leurs notes sont conservés. Seules les paires
 * retirées sont supprimées et les nouvelles créées. L'auto-évaluation est toujours exclue.
 */
async function synchroniser(
  campagneId: string,
  fixe: { evalueId: string } | { evaluateurId: string },
  cote: 'evaluateurId' | 'evalueId',
  voulus: unknown[],
  soiMeme: string
) {
  const cibles = new Set(voulus.filter((v): v is string => typeof v === 'string' && v !== '' && v !== soiMeme))
  const existantes = await prisma.affectation.findMany({
    where: { campagneId, ...fixe },
    select: { id: true, evaluateurId: true, evalueId: true },
  })
  const actuels = new Set(existantes.map((a) => a[cote]))

  const aSupprimer = existantes.filter((a) => !cibles.has(a[cote])).map((a) => a.id)
  const aCreer = [...cibles].filter((c) => !actuels.has(c))

  await prisma.$transaction([
    prisma.affectation.deleteMany({ where: { id: { in: aSupprimer } } }),
    prisma.affectation.createMany({
      data: aCreer.map((c) => ({ campagneId, ...fixe, [cote]: c }) as { campagneId: string; evaluateurId: string; evalueId: string }),
      skipDuplicates: true,
    }),
  ])

  return { ajoutees: aCreer.length, retirees: aSupprimer.length }
}
