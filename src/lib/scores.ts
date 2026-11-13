import prisma from '@/lib/prisma'
import { calculerScoresDepuis, type ScoreCalcule } from '@/lib/calcul-scores'

// Règles de calcul (pondérations, invalidations, notants défaillants) : src/lib/calcul-scores.ts
export { attribuerRangs, comparerScores, type ScoreCalcule } from '@/lib/calcul-scores'

export async function calculerScores(campagneId: string): Promise<ScoreCalcule[]> {
  const campagne = await prisma.campagne.findUnique({
    where: { id: campagneId },
    select: { poidsCollegues: true, poidsManager: true, poidsClient: true, seuilNotants: true },
  })
  if (!campagne) return []

  const [affectations, notes, notesClients] = await Promise.all([
    prisma.affectation.findMany({
      where: { campagneId },
      select: {
        evaluateurId: true, evalueId: true, statut: true, invalidee: true, clientInterne: true,
        evaluateur: { select: { role: true } },
      },
    }),
    prisma.note.findMany({
      where: { campagneId },
      select: { evaluateurId: true, evalueId: true, valeur: true, critere: { select: { noteMaximale: true } } },
    }),
    prisma.noteClient.findMany({
      where: { campagneId },
      select: { agentId: true, clientId: true, ipHash: true, id: true, valeur: true, critere: { select: { noteMaximale: true } } },
    }),
  ])

  return calculerScoresDepuis({
    campagne,
    affectations: affectations.map(({ evaluateur, ...a }) => ({ ...a, roleEvaluateur: evaluateur.role })),
    notes: notes.map(({ critere, ...n }) => ({ ...n, noteMaximale: critere.noteMaximale })),
    notesClients: notesClients.map((nc) => ({
      agentId: nc.agentId,
      source: nc.clientId || nc.ipHash || nc.id,
      valeur: nc.valeur,
      noteMaximale: nc.critere.noteMaximale,
    })),
  })
}

/** Calcule et enregistre les scores ; supprime ceux des agents qui n'ont plus aucune note. */
export async function enregistrerScores(campagneId: string) {
  const scores = await calculerScores(campagneId)
  await prisma.$transaction([
    prisma.scoreFinal.deleteMany({
      where: { campagneId, utilisateurId: { notIn: scores.map((s) => s.utilisateurId) } },
    }),
    ...scores.map((s) =>
      prisma.scoreFinal.upsert({
        where: { utilisateurId_campagneId: { utilisateurId: s.utilisateurId, campagneId } },
        update: {
          scoreCollegues: s.scoreCollegues, scoreManager: s.scoreManager, scoreClient: s.scoreClient, scoreTotal: s.scoreTotal,
          managerNeutralise: s.managerNeutralise, colleguesNeutralise: s.colleguesNeutralise,
          situation: s.situation, nbNotants: s.nbNotants, nbNotantsAttendus: s.nbNotantsAttendus, rang: s.rang,
        },
        create: { ...s, campagneId },
      })
    ),
  ])
  return scores
}
