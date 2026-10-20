import prisma from '@/lib/prisma'
import { DIRECTION_PAR_DEFAUT } from '@/lib/agents'
import { ROLES } from '@/lib/roles'
import { LISTES_LIBRES, LISTES_VIDES, type ListeLibre, type Listes } from '@/lib/listes'

const cle = (s: string) => s.trim().toLocaleLowerCase('fr')

/** Toutes les listes, avec le nombre de fiches agents qui utilisent chaque valeur. */
export async function chargerListes(): Promise<Listes> {
  const [valeurs, roles, ...parChamp] = await Promise.all([
    prisma.valeurListe.findMany({ orderBy: { libelle: 'asc' } }),
    prisma.utilisateur.groupBy({ by: ['role'], _count: { _all: true } }),
    ...Object.values(LISTES_LIBRES).map(({ champ }) =>
      prisma.utilisateur.groupBy({ by: [champ], _count: { _all: true } })
    ),
  ])

  // Les fiches peuvent différer d'une liste par la casse ou des espaces : on compte sans en tenir compte.
  const comptes = new Map<string, Map<string, number>>()
  Object.entries(LISTES_LIBRES).forEach(([liste, { champ }], i) => {
    const m = new Map<string, number>()
    for (const ligne of parChamp[i] as Array<Record<string, unknown> & { _count: { _all: number } }>) {
      const v = ligne[champ]
      if (typeof v === 'string' && v.trim()) m.set(cle(v), (m.get(cle(v)) ?? 0) + ligne._count._all)
    }
    comptes.set(liste, m)
  })
  const parRole = new Map(roles.map((r) => [r.role as string, r._count._all]))

  const listes: Listes = structuredClone(LISTES_VIDES)
  for (const v of valeurs) {
    if (v.liste === 'ROLE') continue
    if (!(v.liste in LISTES_LIBRES)) continue
    listes[v.liste as ListeLibre].push({
      id: v.id,
      libelle: v.libelle,
      code: null,
      parDefaut: v.parDefaut,
      utilisations: comptes.get(v.liste)?.get(cle(v.libelle)) ?? 0,
    })
  }
  // Rôles : toujours les quatre, dans l'ordre de l'application, avec le libellé choisi.
  listes.ROLE = ROLES.map((r) => {
    const v = valeurs.find((x) => x.liste === 'ROLE' && x.code === r.valeur)
    return {
      id: v?.id ?? `role-${r.valeur}`,
      libelle: v?.libelle ?? r.libelle,
      code: r.valeur,
      parDefaut: false,
      utilisations: parRole.get(r.valeur) ?? 0,
    }
  })
  return listes
}

/** Direction attribuée aux agents créés sans direction : celle marquée par défaut. */
export async function directionParDefaut() {
  const v = await prisma.valeurListe.findFirst({ where: { liste: 'DIRECTION', parDefaut: true }, select: { libelle: true } })
  return v?.libelle ?? DIRECTION_PAR_DEFAUT
}

/**
 * Ajoute aux listes les valeurs saisies qui n'y figurent pas encore (création, import),
 * pour que chaque fiche reste sélectionnable dans les listes déroulantes.
 */
export async function completerListes(fiches: Array<Partial<Record<string, unknown>>>) {
  const existantes = await prisma.valeurListe.findMany({ where: { liste: { in: Object.keys(LISTES_LIBRES) } } })
  const connues = new Set(existantes.map((v) => `${v.liste}|${cle(v.libelle)}`))
  const nouvelles: { liste: string; libelle: string }[] = []
  for (const fiche of fiches) {
    for (const [liste, { champ }] of Object.entries(LISTES_LIBRES)) {
      const brut = fiche[champ]
      if (typeof brut !== 'string' || !brut.trim()) continue
      const k = `${liste}|${cle(brut)}`
      if (connues.has(k)) continue
      connues.add(k)
      nouvelles.push({ liste, libelle: brut.trim() })
    }
  }
  if (nouvelles.length) await prisma.valeurListe.createMany({ data: nouvelles, skipDuplicates: true })
}
