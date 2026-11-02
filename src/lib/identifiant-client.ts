/**
 * Identification d'un client externe — règles pures, utilisables côté client et serveur.
 *
 * Un client se connecte avec son téléphone ou son adresse e-mail, selon ce que la DSM connaît de lui :
 * - téléphone seul → téléphone ; e-mail seul → e-mail ;
 * - les deux → au choix du client, l'un ou l'autre ;
 * - ni l'un ni l'autre → connexion impossible.
 * Les adresses générées à l'import (…@dsm.local) ne sont pas de vrais e-mails et ne comptent pas.
 */

export type IdentifiantClient = 'telephone' | 'email'
export type CoordonneesClient = { telephone: string | null; email: string | null }
export type VerdictSaisie = { ok: true } | { ok: false; raison: 'telephone_exige' | 'email_exige' | 'aucun_identifiant' }

/** Clé de stockage de session qui transmet la saisie de l'accueil (onglet « Client externe ») à la page /qr. */
export const CLE_TRANSMISSION = 'dsm-client-identifiant'

/** Un numéro doit avoir au moins 8 chiffres pour servir d'identifiant. */
export const MIN_PHONE_DIGITS = 8

const DOMAINE_FICTIF = '@dsm.local'
const FORME_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Supprime espaces, tirets, parenthèses, points et « + » d'un numéro de téléphone. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()+.]/g, '')
}

/** Adresses générées à l'import, qui ne correspondent à aucune boîte réelle. */
export function emailEstReel(email: string | null | undefined): email is string {
  return Boolean(email && email.includes('@') && !email.toLowerCase().endsWith(DOMAINE_FICTIF))
}

/** Nature de ce que le client a saisi, ou null si ce n'est ni un e-mail ni un numéro complet. */
export function typeDeSaisie(saisie: string): IdentifiantClient | null {
  const brut = saisie.trim()
  if (brut.includes('@')) return FORME_EMAIL.test(brut) ? 'email' : null
  const tel = normalizePhone(brut)
  return /^\d+$/.test(tel) && tel.length >= MIN_PHONE_DIGITS ? 'telephone' : null
}

/** Identifiants avec lesquels le client peut se connecter, au choix : vide s'il n'en a aucun d'utilisable. */
export function identifiantsAcceptes(client: CoordonneesClient): IdentifiantClient[] {
  const acceptes: IdentifiantClient[] = []
  if (client.telephone?.trim()) acceptes.push('telephone')
  if (emailEstReel(client.email)) acceptes.push('email')
  return acceptes
}

export const MESSAGE_CLIENT_SANS_IDENTIFIANT =
  'Un client externe doit avoir un numéro de téléphone ou une adresse e-mail réelle (pas en @dsm.local) pour se connecter.'

/** Ce qu'on demande à l'inscription d'un client externe : son entité, puis son téléphone et/ou son e-mail. */
export type FicheClient = { entite: string; telephone: string; email: string }

/** Message d'erreur de la fiche d'un nouveau client externe, ou null si elle est complète. */
export function erreurFicheClient({ entite, telephone, email }: FicheClient): string | null {
  if (!entite.trim()) return "L'entité du client est obligatoire."
  if (telephone.trim() && typeDeSaisie(telephone) !== 'telephone') {
    return `Le numéro de téléphone doit comporter au moins ${MIN_PHONE_DIGITS} chiffres.`
  }
  if (email.trim() && typeDeSaisie(email) !== 'email') return "L'adresse e-mail n'est pas valide."
  if (identifiantsAcceptes({ telephone, email }).length === 0) return MESSAGE_CLIENT_SANS_IDENTIFIANT
  return null
}

/** Adresse unique (exigée par la base) d'un client inscrit sans e-mail : elle ne sert jamais à se connecter. */
export function emailFictifClient(matricule: string): string {
  return `${matricule.toLowerCase()}${DOMAINE_FICTIF}`
}

/** La saisie (déjà rapprochée de ce client) est-elle l'un des identifiants avec lesquels il peut se connecter ? */
export function verifierSaisieClient(saisie: IdentifiantClient, client: CoordonneesClient): VerdictSaisie {
  const acceptes = identifiantsAcceptes(client)
  if (acceptes.length === 0) return { ok: false, raison: 'aucun_identifiant' }
  if (acceptes.includes(saisie)) return { ok: true }
  return { ok: false, raison: acceptes[0] === 'telephone' ? 'telephone_exige' : 'email_exige' }
}
