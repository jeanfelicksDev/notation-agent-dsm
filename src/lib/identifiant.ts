import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/** Supprime espaces, tirets, parenthèses et « + » d'un numéro de téléphone. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()+.]/g, '')
}

/** Un numéro doit avoir au moins 8 chiffres pour servir d'identifiant. */
const MIN_PHONE_DIGITS = 8

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

  const tel = normalizePhone(brut)
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
