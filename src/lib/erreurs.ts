/** Code d'erreur Prisma (ex. P2002 = contrainte d'unicité, P2025 = enregistrement introuvable). */
export function codePrisma(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined
}
