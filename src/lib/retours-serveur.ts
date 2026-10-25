import prisma from '@/lib/prisma'
import { estEvaluateurManager } from '@/lib/criteres'
import type { NoteSoumise, SourceRetour } from '@/lib/commentaires'

/** Campagne demandée, sinon la dernière calculée, puis la dernière ouverte, puis la plus récente. */
export async function campagneDesRetours(campagneId: string | null) {
  const select = { id: true, libelle: true, statut: true } as const
  if (campagneId) return prisma.campagne.findUnique({ where: { id: campagneId }, select })
  return (
    (await prisma.campagne.findFirst({ where: { statut: 'CALCULEE' }, orderBy: { createdAt: 'desc' }, select })) ||
    (await prisma.campagne.findFirst({ where: { statut: 'OUVERTE' }, orderBy: { createdAt: 'desc' }, select })) ||
    (await prisma.campagne.findFirst({ orderBy: { createdAt: 'desc' }, select }))
  )
}

/**
 * Notes soumises d'une campagne, regroupées par collaborateur noté, prêtes pour
 * construireFicheRetours. Comme pour les scores : seules les évaluations internes
 * soumises (affectation TERMINEE, non invalidée) comptent ; les avis clients QR sont repris tels quels.
 */
export async function notesSoumisesParNote(campagneId: string, evalueId?: string): Promise<Map<string, NoteSoumise[]>> {
  const [affectations, notes, notesClients] = await Promise.all([
    prisma.affectation.findMany({
      where: { campagneId, statut: 'TERMINEE', invalidee: false, ...(evalueId ? { evalueId } : {}) },
      select: {
        evaluateurId: true,
        evalueId: true,
        clientInterne: true,
        evaluateur: { select: { role: true, service: true } },
        evalue: { select: { service: true } },
      },
    }),
    prisma.note.findMany({
      where: { campagneId, ...(evalueId ? { evalueId } : {}) },
      select: {
        id: true, evaluateurId: true, evalueId: true, critereId: true, valeur: true, commentaire: true,
        critere: { select: { libelle: true, noteMaximale: true } },
      },
    }),
    prisma.noteClient.findMany({
      where: { campagneId, ...(evalueId ? { agentId: evalueId } : {}) },
      select: {
        id: true, agentId: true, clientId: true, ipHash: true, critereId: true, valeur: true, commentaire: true,
        critere: { select: { libelle: true, noteMaximale: true } },
      },
    }),
  ])

  // Même répartition que pour l'attribution des critères (voir criteresPourPaire)
  const sourcePar = new Map<string, SourceRetour>()
  for (const a of affectations) {
    const source: SourceRetour = estEvaluateurManager(a.evaluateur.role)
      ? 'MANAGER'
      : a.clientInterne || a.evaluateur.service !== a.evalue.service
        ? 'CLIENT_INTERNE'
        : 'COLLEGUE'
    sourcePar.set(`${a.evaluateurId}:${a.evalueId}`, source)
  }

  const resultat = new Map<string, NoteSoumise[]>()
  const ajouter = (cible: string, n: NoteSoumise) => resultat.set(cible, [...(resultat.get(cible) ?? []), n])

  for (const n of notes) {
    const source = sourcePar.get(`${n.evaluateurId}:${n.evalueId}`)
    if (!source) continue // brouillon ou évaluation invalidée
    ajouter(n.evalueId, {
      id: n.id,
      contributeur: `interne:${n.evaluateurId}`,
      source,
      critereId: n.critereId,
      critereLibelle: n.critere.libelle,
      valeur: n.valeur,
      noteMaximale: n.critere.noteMaximale || 5,
      commentaire: n.commentaire,
    })
  }
  for (const nc of notesClients) {
    ajouter(nc.agentId, {
      id: nc.id,
      contributeur: `client:${nc.clientId || nc.ipHash || nc.id}`,
      source: 'CLIENT',
      critereId: nc.critereId,
      critereLibelle: nc.critere.libelle,
      valeur: nc.valeur,
      noteMaximale: nc.critere.noteMaximale || 5,
      commentaire: nc.commentaire,
    })
  }
  return resultat
}
