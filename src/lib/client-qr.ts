import prisma from '@/lib/prisma'
import { trouverParTelephone } from '@/lib/identifiant'
import { typeDeSaisie, verifierSaisieClient } from '@/lib/identifiant-client'
import { filtreAgentsEvaluables } from '@/lib/perimetre-client'

type ClientIdentifie = { id: string; nom: string; prenom: string }
export type IdentificationClient = { ok: true; client: ClientIdentifie } | { ok: false; statut: 400 | 403 | 404; erreur: string }

const SELECT_CLIENT = { id: true, nom: true, prenom: true, telephone: true, email: true } as const

const MESSAGES_REFUS = {
  telephone_exige: 'Pour ce compte, connectez-vous avec votre numéro de téléphone.',
  email_exige: 'Pour ce compte, connectez-vous avec votre adresse e-mail.',
  aucun_identifiant: 'Aucun téléphone ni adresse e-mail n’est enregistré pour ce compte. Contactez votre interlocuteur DSM.',
} as const

/**
 * Identifie un client externe (rôle EXTERNE) par son téléphone ou son adresse e-mail.
 * Règle (lib/identifiant-client) : le téléphone prime ; l'e-mail ne sert qu'aux clients sans téléphone.
 */
export async function identifierClientExterne(saisie: string): Promise<IdentificationClient> {
  const type = typeDeSaisie(saisie)
  if (!type) {
    return { ok: false, statut: 400, erreur: 'Saisissez votre numéro de téléphone complet ou votre adresse e-mail.' }
  }

  const client =
    type === 'email'
      ? await prisma.utilisateur.findFirst({
          where: { role: 'EXTERNE', email: { equals: saisie.trim(), mode: 'insensitive' } },
          select: SELECT_CLIENT,
        })
      : await trouverParTelephone(saisie, SELECT_CLIENT, { role: 'EXTERNE' })
  if (!client) {
    // Un numéro inconnu peut être celui d'un client enregistré par son seul e-mail : on l'invite à essayer son adresse.
    const erreur =
      type === 'telephone'
        ? 'Ce numéro n’est pas enregistré comme client. Essayez avec votre adresse e-mail.'
        : 'Cette adresse e-mail n’est pas enregistrée comme client. Vérifiez votre saisie ou contactez votre interlocuteur DSM.'
    return { ok: false, statut: 404, erreur }
  }

  const verdict = verifierSaisieClient(type, client)
  if (!verdict.ok) return { ok: false, statut: 403, erreur: MESSAGES_REFUS[verdict.raison] }
  return { ok: true, client: { id: client.id, nom: client.nom, prenom: client.prenom } }
}

/**
 * Agents qu'un client peut évaluer pendant une campagne : ceux qui lui sont affectés s'il en a
 * (QR activé ou non), sinon tous les agents dont la notation QR est activée (lib/perimetre-client).
 */
export async function agentsEvaluablesPar(clientId: string, campagneId: string) {
  const affectations = await prisma.affectation.findMany({
    where: { evaluateurId: clientId, campagneId },
    select: { evalueId: true },
  })

  return prisma.utilisateur.findMany({
    where: filtreAgentsEvaluables(affectations.map((a) => a.evalueId)),
    select: { id: true, nom: true, prenom: true, service: true, emploi: true },
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
  })
}
