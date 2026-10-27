import prisma from '@/lib/prisma'

/**
 * Reconduction des affectations d'une campagne vers une autre.
 *
 * Les paires notant → noté de la campagne source, avec leur qualité « client interne », remplacent
 * celles de la campagne cible. Les statuts repartent de zéro (EN_ATTENTE) et les invalidations
 * (force majeure) ne sont pas reprises : elles concernent un événement ponctuel.
 * Sont ignorées les paires dont le noté n'est plus un Pair (seuls les Pairs sont notés).
 * Refusée si la cible a déjà des évaluations soumises, pour ne jamais effacer un vote.
 */

export class ErreurReconduction extends Error {}

export type ResultatReconduction = {
  reconduites: number
  ignorees: number
  remplacees: number
}

export async function reconduireAffectations(cibleId: string, sourceId: string): Promise<ResultatReconduction> {
  if (!sourceId || sourceId === cibleId) {
    throw new ErreurReconduction('Choisissez une autre campagne comme source.')
  }

  const [source, cible, soumises] = await Promise.all([
    prisma.campagne.findUnique({ where: { id: sourceId }, select: { id: true } }),
    prisma.campagne.findUnique({ where: { id: cibleId }, select: { id: true } }),
    prisma.affectation.count({ where: { campagneId: cibleId, statut: 'TERMINEE' } }),
  ])
  if (!source || !cible) throw new ErreurReconduction('Campagne introuvable.')
  if (soumises > 0) {
    throw new ErreurReconduction(
      `Cette campagne a déjà ${soumises} évaluation${soumises > 1 ? 's' : ''} soumise${soumises > 1 ? 's' : ''} : ses affectations ne peuvent plus être remplacées.`
    )
  }

  const paires = await prisma.affectation.findMany({
    where: { campagneId: sourceId },
    select: { evaluateurId: true, evalueId: true, clientInterne: true, evalue: { select: { role: true } } },
  })
  const valides = paires.filter((p) => p.evalue.role === 'UTILISATEUR' && p.evaluateurId !== p.evalueId)

  // Les notes de la cible ne sont que des brouillons (aucune évaluation soumise) : elles partent avec leurs affectations.
  const [, supprimees, creees] = await prisma.$transaction([
    prisma.note.deleteMany({ where: { campagneId: cibleId } }),
    prisma.affectation.deleteMany({ where: { campagneId: cibleId } }),
    prisma.affectation.createMany({
      data: valides.map((p) => ({
        campagneId: cibleId,
        evaluateurId: p.evaluateurId,
        evalueId: p.evalueId,
        clientInterne: p.clientInterne,
      })),
      skipDuplicates: true,
    }),
  ])

  return { reconduites: creees.count, ignorees: paires.length - creees.count, remplacees: supprimees.count }
}

export function messageReconduction(r: ResultatReconduction): string {
  const parties = [`${r.reconduites} affectation${r.reconduites > 1 ? 's' : ''} reconduite${r.reconduites > 1 ? 's' : ''}`]
  if (r.remplacees) parties.push(`${r.remplacees} remplacée${r.remplacees > 1 ? 's' : ''}`)
  if (r.ignorees) parties.push(`${r.ignorees} ignorée${r.ignorees > 1 ? 's' : ''} (noté qui n'est plus un Pair)`)
  return `${parties.join(', ')}.`
}
