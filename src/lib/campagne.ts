import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

/**
 * La campagne ouverte. L'administration garantit qu'il n'y en a qu'une ;
 * en cas d'incohérence historique, on retient la plus récente de façon déterministe.
 */
export function getCampagneOuverte() {
  return prisma.campagne.findFirst({
    where: { statut: 'OUVERTE' },
    orderBy: [{ dateDebut: 'desc' }, { createdAt: 'desc' }],
  })
}

/** Campagnes qui entrent dans le palmarès annuel : celles de l'année, une fois terminées. */
export function campagnesDuPalmaresAnnuel(annee: number): Prisma.CampagneWhereInput {
  return {
    statut: { not: 'OUVERTE' },
    dateDebut: { gte: new Date(`${annee}-01-01T00:00:00Z`), lte: new Date(`${annee}-12-31T23:59:59.999Z`) },
  }
}

/** La notation est possible du premier jour à la fin du dernier jour de la campagne. */
export function campagneEnCours(c: { dateDebut: Date; dateFin: Date }, now = new Date()) {
  const fin = new Date(c.dateFin)
  fin.setHours(23, 59, 59, 999)
  const debut = new Date(c.dateDebut)
  debut.setHours(0, 0, 0, 0)
  return now >= debut && now <= fin
}

export function messageHorsPeriode(c: { dateDebut: Date; dateFin: Date }, now = new Date()) {
  const fmt = (d: Date) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return now < new Date(c.dateDebut)
    ? `La notation ouvrira le ${fmt(c.dateDebut)}.`
    : `La période de notation s’est terminée le ${fmt(c.dateFin)}.`
}

/** Vérifie les pondérations d'une campagne (en points sur 100). */
export function validerPoids(p: { poidsCollegues: number; poidsManager: number; poidsClient: number }): string | null {
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100
  if (!ok(p.poidsCollegues) || !ok(p.poidsManager) || !ok(p.poidsClient)) {
    return 'Les pondérations doivent être des nombres entiers entre 0 et 100.'
  }
  if (p.poidsCollegues + p.poidsManager !== 100) {
    return 'La part manager et la part collègues/clients doivent totaliser 100 points.'
  }
  if (p.poidsClient > p.poidsCollegues) {
    return 'La part des clients QR est incluse dans la part collègues/clients : elle ne peut pas la dépasser.'
  }
  return null
}
