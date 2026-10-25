/**
 * Commentaires de notation : règles de saisie et anonymisation de la fiche de retours.
 * Module pur (sans accès base), partagé entre le questionnaire et le serveur.
 */

/** Nombre minimal de notants derrière un commentaire pour qu'il puisse être montré. */
export const SEUIL_ANONYMAT = 3

/** Part du barème en dessous de laquelle (incluse) une note est un reproche : 2 sur 5, 4 sur 10. */
const RATIO_REPROCHE = 0.4
/** Part du barème à partir de laquelle une note est un point fort : 4 sur 5, 8 sur 10. */
const RATIO_POINT_FORT = 0.8

export function seuilCommentaireObligatoire(noteMaximale: number): number {
  return Math.round(noteMaximale * RATIO_REPROCHE)
}

/** Une note basse doit être expliquée pour être exploitable en entretien. */
export function commentaireObligatoire(valeur: number, noteMaximale: number): boolean {
  return valeur > 0 && valeur <= seuilCommentaireObligatoire(noteMaximale)
}

export type Tonalite = 'reproche' | 'neutre' | 'point_fort'

export function tonalite(valeur: number, noteMaximale: number): Tonalite {
  if (valeur <= seuilCommentaireObligatoire(noteMaximale)) return 'reproche'
  if (valeur >= Math.round(noteMaximale * RATIO_POINT_FORT)) return 'point_fort'
  return 'neutre'
}

/* ─── Anonymisation ─────────────────────────────────────────────── */

export type SourceRetour = 'MANAGER' | 'COLLEGUE' | 'CLIENT_INTERNE' | 'CLIENT'
export type Famille = 'interne' | 'client'

export const famille = (s: SourceRetour): Famille => (s === 'CLIENT' ? 'client' : 'interne')

const LIBELLE_SOURCE: Record<SourceRetour, string> = {
  MANAGER: 'Manager',
  COLLEGUE: 'Collègues',
  CLIENT_INTERNE: 'Clients internes',
  CLIENT: 'Clients externes',
}
const LIBELLE_FAMILLE: Record<Famille, string> = { interne: 'Retour interne', client: 'Retour client' }

/** Une note soumise : sert à compter qui a noté chaque critère, commentaire ou non. */
export type NoteSoumise = {
  /** Identifiant stable et interne de la note : sert seulement à mélanger l'ordre d'affichage. */
  id: string
  /** Identifiant du notant (évaluateur ou client) : ne sort jamais de ce module. */
  contributeur: string
  source: SourceRetour
  critereId: string
  critereLibelle: string
  valeur: number
  noteMaximale: number
  commentaire: string | null
}

export type CommentaireAnonyme = {
  texte: string
  valeur: number
  noteMaximale: number
  tonalite: Tonalite
  /** Source la plus précise compatible avec l'anonymat : « Collègues », « Retour client »… */
  provenance: string
}

export type CritereRetours = {
  critereId: string
  critereLibelle: string
  commentaires: CommentaireAnonyme[]
}

export type FicheRetours = {
  criteres: CritereRetours[]
  totaux: Record<Tonalite, number>
  /** Commentaires écartés faute d'assez de notants pour protéger leur auteur. */
  masques: number
}

const ORDRE_TONALITE: Record<Tonalite, number> = { reproche: 0, neutre: 1, point_fort: 2 }

/** Ordre pseudo-aléatoire mais stable, sans lien avec l'auteur ni l'heure de saisie. */
export function empreinte(texte: string): number {
  let h = 2166136261
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Construit la fiche de retours d'un collaborateur sans révéler l'auteur des commentaires.
 *
 * Le groupe d'anonymat d'un commentaire est l'ensemble des personnes ayant noté le même
 * critère : un commentaire écrit par 1 notant sur 5 reste caché parmi les 5. Pour chaque
 * commentaire, on affiche la provenance la plus précise qui compte au moins SEUIL_ANONYMAT
 * notants (source, puis famille interne/client, puis aucune) ; sinon il est masqué.
 */
export function construireFicheRetours(notes: NoteSoumise[], seuil = SEUIL_ANONYMAT): FicheRetours {
  const notantsPar = new Map<string, Set<string>>()
  const compter = (cle: string, contributeur: string) => {
    const set = notantsPar.get(cle) ?? new Set<string>()
    set.add(contributeur)
    notantsPar.set(cle, set)
  }
  for (const n of notes) {
    compter(`${n.critereId}|source|${n.source}`, n.contributeur)
    compter(`${n.critereId}|famille|${famille(n.source)}`, n.contributeur)
    compter(`${n.critereId}|tous`, n.contributeur)
  }
  const nb = (cle: string) => notantsPar.get(cle)?.size ?? 0

  type Entree = { critereId: string; critereLibelle: string; items: { commentaire: CommentaireAnonyme; cle: number }[] }
  const parCritere = new Map<string, Entree>()
  const totaux: Record<Tonalite, number> = { reproche: 0, neutre: 0, point_fort: 0 }
  let masques = 0

  for (const n of notes) {
    const texte = n.commentaire?.trim()
    if (!texte) continue

    let provenance: string | null = null
    if (nb(`${n.critereId}|source|${n.source}`) >= seuil) provenance = LIBELLE_SOURCE[n.source]
    else if (nb(`${n.critereId}|famille|${famille(n.source)}`) >= seuil) provenance = LIBELLE_FAMILLE[famille(n.source)]
    else if (nb(`${n.critereId}|tous`) >= seuil) provenance = 'Retour'

    if (!provenance) {
      masques++
      continue
    }

    const ton = tonalite(n.valeur, n.noteMaximale)
    totaux[ton]++
    const entree: Entree = parCritere.get(n.critereId) ?? { critereId: n.critereId, critereLibelle: n.critereLibelle, items: [] }
    entree.items.push({
      commentaire: { texte, valeur: n.valeur, noteMaximale: n.noteMaximale, tonalite: ton, provenance },
      cle: empreinte(n.id),
    })
    parCritere.set(n.critereId, entree)
  }

  const criteres: CritereRetours[] = [...parCritere.values()]
    .map(({ items, ...c }) => ({
      ...c,
      commentaires: [...items]
        .sort((a, b) => ORDRE_TONALITE[a.commentaire.tonalite] - ORDRE_TONALITE[b.commentaire.tonalite] || a.cle - b.cle)
        .map((i) => i.commentaire),
    }))
    // Les critères les plus reprochés d'abord : ce sont eux qui nourrissent l'entretien
    .sort(
      (a, b) =>
        b.commentaires.filter((x) => x.tonalite === 'reproche').length - a.commentaires.filter((x) => x.tonalite === 'reproche').length ||
        a.critereLibelle.localeCompare(b.critereLibelle, 'fr')
    )

  return { criteres, totaux, masques }
}
