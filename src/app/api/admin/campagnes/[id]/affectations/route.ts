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
    const { mode, evaluateurId, evalueId, evalueIds, evaluateurIds, autoGenerate, clientsInternes } = body
    // Identifiants (du côté sélectionné) dont l'affectation est « client interne »
    const internes = new Set<string>(Array.isArray(clientsInternes) ? clientsInternes.filter((x: unknown): x is string => typeof x === 'string') : [])

    // 1. Auto-génération TAMIS globale
    if (autoGenerate) {
      const allUsers = await prisma.utilisateur.findMany()

      const newAffectationsData: { campagneId: string; evaluateurId: string; evalueId: string }[] = []
      const existingKeys = new Set<string>()

      // Seuls les agents opérationnels sont notés (ni managers, ni clients, ni administrateurs)
      const evalueUsers = allUsers.filter(u => u.role === 'UTILISATEUR')
      const managerUsers = allUsers.filter(u => u.role === 'MANAGER')

      for (const user of evalueUsers) {
        // A. Assigner les collègues (pairs) du même service, ainsi que les cadres du service (vote facultatif)
        if (user.service) {
          const sameServicePeers = allUsers.filter(u => u.service === user.service && u.id !== user.id && (u.role === 'UTILISATEUR' || u.role === 'CADRE'))
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

    // 1 bis. Les Pairs d'un même service se notent tous entre eux (paires manquantes seulement)
    if (mode === 'pairs_service') {
      const ajoutees = await affecterPairsDuService(id)
      return NextResponse.json({ success: true, ajoutees })
    }

    // 2. Mode PAR COLLABORATEUR (Évalué) : la liste `evaluateurIds` devient celle des évaluateurs de `evalueId`.
    if (mode === 'by_evalue' || (evalueId && Array.isArray(evaluateurIds))) {
      if (!evalueId || !Array.isArray(evaluateurIds)) {
        return NextResponse.json({ error: 'Données invalides pour le mode collaborateur' }, { status: 400 })
      }
      const resultat = await synchroniser(id, { evalueId }, 'evaluateurId', evaluateurIds, evalueId, internes)
      return NextResponse.json({ success: true, ...resultat })
    }

    // 3. Mode PAR ÉVALUATEUR (Notant) : la liste `evalueIds` devient celle des collaborateurs notés par `evaluateurId`.
    if (!evaluateurId || !Array.isArray(evalueIds)) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }
    const resultat = await synchroniser(id, { evaluateurId }, 'evalueId', evalueIds, evaluateurId, internes)
    return NextResponse.json({ success: true, ...resultat })
  } catch (error) {
    if (error instanceof ErreurAffectation) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Affectation error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour des affectations' }, { status: 500 })
  }
}

/**
 * Chaque Pair est noté par tous les autres Pairs de son service. N'ajoute que les paires manquantes :
 * les affectations existantes (managers, clients internes, statuts, notes) restent intactes.
 */
async function affecterPairsDuService(campagneId: string): Promise<number> {
  const pairs = await prisma.utilisateur.findMany({
    where: { role: 'UTILISATEUR', service: { not: null } },
    select: { id: true, service: true },
  })
  const parService = new Map<string, string[]>()
  for (const p of pairs) {
    const service = p.service!.trim()
    if (!service) continue
    parService.set(service, [...(parService.get(service) ?? []), p.id])
  }

  const data = [...parService.values()].flatMap((ids) =>
    ids.flatMap((evaluateurId) =>
      ids.filter((evalueId) => evalueId !== evaluateurId).map((evalueId) => ({ campagneId, evaluateurId, evalueId }))
    )
  )
  if (data.length === 0) return 0
  const { count } = await prisma.affectation.createMany({ data, skipDuplicates: true })
  return count
}

/**
 * DELETE — remet à zéro la répartition de la campagne : toutes ses affectations et les notes internes
 * qui en dépendent (brouillons comme évaluations soumises), ainsi que les scores enregistrés.
 * Les avis clients (QR) sont conservés.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    // Les scores enregistrés reposaient sur ces notes : ils partent aussi
    const [notes, affectations] = await prisma.$transaction([
      prisma.note.deleteMany({ where: { campagneId: id } }),
      prisma.affectation.deleteMany({ where: { campagneId: id } }),
      prisma.scoreFinal.deleteMany({ where: { campagneId: id } }),
    ])
    return NextResponse.json({ success: true, affectations: affectations.count, notes: notes.count })
  } catch (error) {
    console.error('Réinitialisation error:', error)
    return NextResponse.json({ error: 'Erreur lors de la réinitialisation des affectations' }, { status: 500 })
  }
}

/** Demande de répartition contraire aux règles métier (renvoyée en 400). */
class ErreurAffectation extends Error {}

/**
 * Aligne les affectations sur la liste voulue SANS toucher à celles qui restent :
 * leur statut (brouillon, soumise) et leurs notes sont conservés. Seules les paires
 * retirées sont supprimées et les nouvelles créées ; la qualité « client interne » est
 * mise à jour sur toutes. L'auto-évaluation est toujours exclue, et un cadre n'est jamais noté.
 */
async function synchroniser(
  campagneId: string,
  fixe: { evalueId: string } | { evaluateurId: string },
  cote: 'evaluateurId' | 'evalueId',
  voulus: unknown[],
  soiMeme: string,
  internes: Set<string>
) {
  const demandes = voulus.filter((v): v is string => typeof v === 'string' && v !== '' && v !== soiMeme)
  // Un cadre peut noter mais ne peut jamais être noté
  const evaluesDemandes = cote === 'evalueId' ? demandes : 'evalueId' in fixe ? [fixe.evalueId] : []
  const cadres = new Set(
    (await prisma.utilisateur.findMany({ where: { id: { in: evaluesDemandes }, role: 'CADRE' }, select: { id: true } })).map((u) => u.id)
  )
  if ('evalueId' in fixe && cadres.has(fixe.evalueId)) {
    throw new ErreurAffectation('Un cadre ne peut pas être noté.')
  }
  const cibles = new Set(demandes.filter((c) => !cadres.has(c)))
  const existantes = await prisma.affectation.findMany({
    where: { campagneId, ...fixe },
    select: { id: true, evaluateurId: true, evalueId: true, clientInterne: true },
  })
  const actuels = new Set(existantes.map((a) => a[cote]))

  const aSupprimer = existantes.filter((a) => !cibles.has(a[cote])).map((a) => a.id)
  const aCreer = [...cibles].filter((c) => !actuels.has(c))

  const aBasculer = existantes.filter((a) => cibles.has(a[cote]) && a.clientInterne !== internes.has(a[cote]))

  await prisma.$transaction([
    prisma.affectation.deleteMany({ where: { id: { in: aSupprimer } } }),
    prisma.affectation.createMany({
      data: aCreer.map((c) => ({ campagneId, ...fixe, [cote]: c, clientInterne: internes.has(c) }) as {
        campagneId: string
        evaluateurId: string
        evalueId: string
        clientInterne: boolean
      }),
      skipDuplicates: true,
    }),
    ...aBasculer.map((a) =>
      prisma.affectation.update({ where: { id: a.id }, data: { clientInterne: internes.has(a[cote]) } })
    ),
  ])

  return { ajoutees: aCreer.length, retirees: aSupprimer.length }
}

const MOTIFS_INVALIDATION = ['FORCE_MAJEURE', 'ACCIDENT', 'DECES', 'AUTRE'] as const
type MotifInvalidation = (typeof MOTIFS_INVALIDATION)[number]

/**
 * Invalide (ou rétablit) les notes d'un notant empêché par un cas de force majeure,
 * un accident ou un décès. Sans `evalueId`, toutes ses affectations de la campagne sont visées.
 * Les notes sont conservées mais ignorées au calcul : les collaborateurs notés restent classés
 * sur leurs autres évaluations (voir src/lib/scores.ts).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json().catch(() => null)
    const evaluateurId = typeof body?.evaluateurId === 'string' ? body.evaluateurId : ''
    const evalueId = typeof body?.evalueId === 'string' ? body.evalueId : undefined
    const motif = MOTIFS_INVALIDATION.find((m) => m === body?.motif) as MotifInvalidation | undefined
    const commentaire = typeof body?.commentaire === 'string' ? body.commentaire.trim().slice(0, 500) : ''

    if (!evaluateurId || typeof body?.invalidee !== 'boolean') {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }
    if (body.invalidee && !motif) {
      return NextResponse.json({ error: "Le motif de l'invalidation est requis" }, { status: 400 })
    }

    const resultat = await prisma.affectation.updateMany({
      where: { campagneId: id, evaluateurId, ...(evalueId ? { evalueId } : {}) },
      data: body.invalidee
        ? { invalidee: true, motifInvalidation: motif, commentaireInvalidation: commentaire || null, invalideeAt: new Date() }
        : { invalidee: false, motifInvalidation: null, commentaireInvalidation: null, invalideeAt: null },
    })
    if (resultat.count === 0) {
      return NextResponse.json({ error: 'Aucune affectation trouvée pour ce notant' }, { status: 404 })
    }

    return NextResponse.json({ success: true, count: resultat.count })
  } catch (error) {
    console.error('Invalidation error:', error)
    return NextResponse.json({ error: "Erreur lors de l'invalidation" }, { status: 500 })
  }
}
