/**
 * Publication des résultats d'une campagne : l'administrateur fixe un jour et une heure.
 * À partir de ce moment, la page des résultats est ouverte à tous, sans connexion ; avant, elle
 * n'affiche qu'un écran d'attente. Sans date, les résultats ne sont pas publiés : seul
 * l'administrateur peut ouvrir la page, pour préparer la révélation.
 */
import { format } from 'date-fns'

/** Format du champ « jour et heure » des formulaires (heure locale du navigateur). */
const FORMAT_SAISIE_LOCALE = "yyyy-MM-dd'T'HH:mm"

const MS_PAR_SECONDE = 1000
const SECONDES_PAR_MINUTE = 60
const SECONDES_PAR_HEURE = 3600
const SECONDES_PAR_JOUR = 86_400

/** Instant complet, fuseau compris (« Z » ou décalage) : sa lecture ne dépend pas du fuseau du serveur. */
const INSTANT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

const estDateValide = (date: Date): boolean => !Number.isNaN(date.getTime())

/**
 * Lit la date de publication reçue par l'API : un instant ISO complet, fuseau compris.
 * Vide (null ou '') : pas de date, les résultats ne sont pas retenus. Renvoie undefined si la valeur est invalide.
 */
export function lireDateResultats(valeur: unknown): Date | null | undefined {
  if (valeur === null || valeur === '') return null
  if (typeof valeur !== 'string' || !INSTANT_ISO.test(valeur)) return undefined
  const date = new Date(valeur)
  return estDateValide(date) ? date : undefined
}

const IDENTIFIANT_PALMARES_ANNUEL = /^ANNUEL_(\d{4})$/

/** Année d'un identifiant de palmarès annuel (« ANNUEL_2026 ») ; null pour tout autre identifiant. */
export function anneeDuPalmaresAnnuel(identifiant: string): number | null {
  const annee = IDENTIFIANT_PALMARES_ANNUEL.exec(identifiant)?.[1]
  return annee ? Number(annee) : null
}

/** Temps qui reste avant la publication, en millisecondes ; 0 dès que les résultats peuvent s'afficher. */
export function delaiAvantPublication(dateResultats: Date | null, maintenant: Date): number {
  if (!dateResultats) return 0
  return Math.max(0, dateResultats.getTime() - maintenant.getTime())
}

/** Ce que la page des résultats affiche à un visiteur. */
export type EcranResultats = 'RESULTATS' | 'ATTENTE' | 'NON_PUBLIES'

/**
 * Écran à afficher sur la page des résultats, ouverte à tous sans connexion.
 * Le public ne voit les résultats qu'à partir de la date de publication : sans date, le classement
 * provisoire d'une campagne en cours ne lui est jamais montré. L'administrateur, lui, peut alors
 * ouvrir la page pour préparer la révélation.
 */
export function ecranDesResultats(dateResultats: Date | null, maintenant: Date, estAdmin: boolean): EcranResultats {
  if (!dateResultats) return estAdmin ? 'RESULTATS' : 'NON_PUBLIES'
  return delaiAvantPublication(dateResultats, maintenant) > 0 ? 'ATTENTE' : 'RESULTATS'
}

/**
 * Date de publication d'un palmarès annuel, d'après celles de ses campagnes : il attend la dernière
 * à être publiée. Pour le public, il n'est pas publié tant qu'une campagne de l'année n'a pas sa date :
 * sa moyenne dévoilerait les résultats de cette campagne.
 */
export function datePublicationAnnuelle(dates: readonly (Date | null)[], estAdmin: boolean): Date | null {
  const fixees = dates.filter((date): date is Date => date !== null)
  if (fixees.length === 0) return null
  if (!estAdmin && fixees.length < dates.length) return null
  return new Date(Math.max(...fixees.map((date) => date.getTime())))
}

/** Date enregistrée → valeur du champ « jour et heure », en heure locale. */
export function versSaisieLocale(dateResultats: string | null | undefined): string {
  if (!dateResultats) return ''
  const date = new Date(dateResultats)
  return estDateValide(date) ? format(date, FORMAT_SAISIE_LOCALE) : ''
}

/**
 * Valeur du champ « jour et heure » (heure locale) → instant envoyé à l'API.
 * null pour un champ vide (aucune retenue) ; undefined pour une saisie illisible, à signaler plutôt qu'à envoyer.
 */
export function depuisSaisieLocale(saisie: string): string | null | undefined {
  if (!saisie) return null
  const date = new Date(saisie)
  return estDateValide(date) ? date.toISOString() : undefined
}

const surDeuxChiffres = (n: number): string => String(n).padStart(2, '0')

/** Temps restant lisible, par exemple « 2 j 03 h 04 min 05 s » ; les unités nulles de tête sont omises. */
export function formaterTempsRestant(delaiMs: number): string {
  // Arrondi à la seconde supérieure : l'affichage n'atteint 0 qu'au moment de la publication.
  const total = Math.max(0, Math.ceil(delaiMs / MS_PAR_SECONDE))
  const jours = Math.floor(total / SECONDES_PAR_JOUR)
  const heures = Math.floor((total % SECONDES_PAR_JOUR) / SECONDES_PAR_HEURE)
  const minutes = Math.floor((total % SECONDES_PAR_HEURE) / SECONDES_PAR_MINUTE)
  const secondes = total % SECONDES_PAR_MINUTE

  if (jours > 0) return `${jours} j ${surDeuxChiffres(heures)} h ${surDeuxChiffres(minutes)} min ${surDeuxChiffres(secondes)} s`
  if (heures > 0) return `${heures} h ${surDeuxChiffres(minutes)} min ${surDeuxChiffres(secondes)} s`
  if (minutes > 0) return `${minutes} min ${surDeuxChiffres(secondes)} s`
  return `${secondes} s`
}
