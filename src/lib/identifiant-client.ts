/**
 * Identification d'un client externe — règles pures, utilisables côté client et serveur.
 *
 * Un client se connecte avec son téléphone ou son adresse e-mail, selon ce que la DSM connaît de lui :
 * - téléphone seul → téléphone ; e-mail seul → e-mail ;
 * - les deux → le téléphone prime : l'e-mail est refusé, avec l'indication d'utiliser le téléphone ;
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

/** Identifiant que le client doit utiliser : le téléphone prime sur l'e-mail. */
export function identifiantExige(client: CoordonneesClient): IdentifiantClient | null {
  if (client.telephone?.trim()) return 'telephone'
  if (emailEstReel(client.email)) return 'email'
  return null
}

export const MESSAGE_CLIENT_SANS_IDENTIFIANT =
  'Un client externe doit avoir un numéro de téléphone ou une adresse e-mail réelle (pas en @dsm.local) pour se connecter.'

/** La saisie (déjà rapprochée de ce client) est-elle l'identifiant qu'il doit utiliser ? */
export function verifierSaisieClient(saisie: IdentifiantClient, client: CoordonneesClient): VerdictSaisie {
  const exige = identifiantExige(client)
  if (exige === null) return { ok: false, raison: 'aucun_identifiant' }
  if (exige === saisie) return { ok: true }
  return { ok: false, raison: exige === 'telephone' ? 'telephone_exige' : 'email_exige' }
}
