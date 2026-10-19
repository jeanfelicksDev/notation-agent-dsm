import prisma from '@/lib/prisma'
import { campagneEnCours, getCampagneOuverte, messageHorsPeriode } from '@/lib/campagne'
import { criteresPourPaire } from '@/lib/criteres'

export type NoteEntrante = { evalueId?: unknown; critereId?: unknown; valeur?: unknown; commentaire?: unknown }
export type NoteValidee = { evalueId: string; critereId: string; valeur: number; commentaire: string | null }

export class ErreurNotation extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

const MAX_COMMENTAIRE = 2000

/**
 * Contexte commun à l'enregistrement d'un brouillon et à la soumission :
 * campagne ouverte et dans sa période, évaluateur, affectations visées et critères attendus.
 * Lève ErreurNotation avec un message destiné à l'évaluateur.
 */
export async function preparerNotation(evaluateurId: string, evalueIds: string[]) {
  if (evalueIds.includes(evaluateurId)) {
    throw new ErreurNotation("L'auto-évaluation est strictement interdite.", 403)
  }

  const campagne = await getCampagneOuverte()
  if (!campagne) throw new ErreurNotation('Aucune campagne ouverte.', 404)
  if (!campagneEnCours(campagne)) throw new ErreurNotation(messageHorsPeriode(campagne), 403)

  const [evaluateur, affectations, criteres] = await Promise.all([
    prisma.utilisateur.findUnique({ where: { id: evaluateurId }, select: { role: true, service: true } }),
    prisma.affectation.findMany({
      where: { evaluateurId, campagneId: campagne.id, evalueId: { in: evalueIds } },
      select: { evalueId: true, statut: true, evalue: { select: { service: true, prenom: true, nom: true } } },
    }),
    prisma.critere.findMany({
      where: { campagneId: campagne.id },
      select: { id: true, libelle: true, noteMaximale: true, typeEvaluateur: true, typeEvaluateurs: true },
    }),
  ])

  if (!evaluateur) throw new ErreurNotation('Compte introuvable.', 404)
  if (affectations.length !== evalueIds.length) {
    throw new ErreurNotation("Certains collaborateurs ne vous sont pas attribués.", 403)
  }
  if (affectations.some((a) => a.statut === 'TERMINEE')) {
    throw new ErreurNotation('Ces évaluations ont déjà été soumises et sont verrouillées.', 409)
  }

  const attendus = new Map(
    affectations.map((a) => [a.evalueId, criteresPourPaire(criteres, evaluateur, a.evalue)])
  )

  /** Ne garde que des notes valides : critère attendu pour ce collaborateur, entier dans le barème. */
  function valider(notes: NoteEntrante[]): NoteValidee[] {
    const vues = new Set<string>()
    const resultat: NoteValidee[] = []
    for (const n of notes) {
      if (typeof n?.evalueId !== 'string' || typeof n.critereId !== 'string') continue
      const critere = attendus.get(n.evalueId)?.find((c) => c.id === n.critereId)
      if (!critere) throw new ErreurNotation('Un critère envoyé ne correspond pas à ce collaborateur.', 400)
      const valeur = Number(n.valeur)
      if (valeur === 0) continue // pas encore noté
      if (!Number.isInteger(valeur) || valeur < 1 || valeur > critere.noteMaximale) {
        throw new ErreurNotation(`Note invalide pour « ${critere.libelle} » (de 1 à ${critere.noteMaximale}).`, 400)
      }
      const cle = `${n.evalueId}:${n.critereId}`
      if (vues.has(cle)) continue
      vues.add(cle)
      const commentaire = typeof n.commentaire === 'string' ? n.commentaire.trim().slice(0, MAX_COMMENTAIRE) : ''
      resultat.push({ evalueId: n.evalueId, critereId: n.critereId, valeur, commentaire: commentaire || null })
    }
    return resultat
  }

  return { campagne, affectations, attendus, valider }
}
