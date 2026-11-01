import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { MIN_PHONE_DIGITS, normalizePhone } from '@/lib/identifiant-client'

export { normalizePhone }

/**
 * Retrouve un utilisateur à partir de ce qu'il saisit : matricule, email ou téléphone.
 * La correspondance est toujours exacte (après normalisation) : jamais de « se termine par »,
 * qui permettrait de tomber sur le compte d'un autre agent.
 */
export async function trouverParIdentifiant<S extends Prisma.UtilisateurSelect>(
  saisie: string,
  select: S,
  where: Prisma.UtilisateurWhereInput = {}
) {
  const brut = saisie.trim()
  if (!brut) return null

  const direct = await prisma.utilisateur.findFirst({
    where: {
      ...where,
      OR: [
        { matricule: { equals: brut, mode: 'insensitive' } },
        { email: { equals: brut.toLowerCase(), mode: 'insensitive' } },
      ],
    },
    select,
  })
  if (direct) return direct
  return trouverParTelephone(brut, select, where)
}

/** Un compte porte-t-il déjà ce numéro (après normalisation) ? Un doublon rendrait le numéro inutilisable. */
export async function telephoneDejaPris(saisie: string, where: Prisma.UtilisateurWhereInput = {}): Promise<boolean> {
  const tel = normalizePhone(saisie.trim())
  const candidats = await prisma.utilisateur.findMany({
    where: { ...where, telephone: { not: null } },
    select: { telephone: true },
  })
  return candidats.some((u) => u.telephone && normalizePhone(u.telephone) === tel)
}

/** Retrouve un utilisateur par son numéro exact (après normalisation) ; null si inconnu ou partagé. */
export async function trouverParTelephone<S extends Prisma.UtilisateurSelect>(
  saisie: string,
  select: S,
  where: Prisma.UtilisateurWhereInput = {}
) {
  const tel = normalizePhone(saisie.trim())
  if (!/^\d+$/.test(tel) || tel.length < MIN_PHONE_DIGITS) return null

  const candidats = await prisma.utilisateur.findMany({
    where: { ...where, telephone: { not: null } },
    select: { id: true, telephone: true },
  })
  const trouve = candidats.filter((u) => u.telephone && normalizePhone(u.telephone) === tel)
  // Un numéro partagé par plusieurs comptes est ambigu : on refuse plutôt que de deviner.
  if (trouve.length !== 1) return null

  return prisma.utilisateur.findUnique({ where: { id: trouve[0].id }, select })
}
