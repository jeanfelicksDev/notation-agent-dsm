import { cookies } from 'next/headers'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import prisma from '@/lib/prisma'
import { estHorsCampagne } from '@/lib/roles'

export const SESSION_COOKIE_NAME = 'eval_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 8 // 8 heures

/** Après MAX_TENTATIVES PIN erronés, le compte est verrouillé VERROU_DURATION_MS. */
export const MAX_TENTATIVES = 5
const VERROU_DURATION_MS = 1000 * 60 * 15 // 15 minutes

/**
 * Hachage sécurisé de mot de passe basé sur scrypt avec sel aléatoire unique
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derivedKey}`
}

const LEGACY_SHA256 = /^[0-9a-f]{64}$/

/**
 * Un PIN (ou mot de passe admin) est considéré comme défini lorsqu'il est stocké
 * sous forme de hash. Une valeur vide ou en clair (import Excel) = PIN à définir.
 */
export function pinEstDefini(storedHash: string | null | undefined): boolean {
  if (!storedHash) return false
  return storedHash.startsWith('scrypt:') || LEGACY_SHA256.test(storedHash)
}

/**
 * Vérifie un mot de passe contre son hash stocké en base.
 * Gère le format scrypt ainsi que la migration transparente des anciens hashs SHA256.
 * Les valeurs en clair ne sont jamais acceptées.
 */
export function verifyPassword(
  password: string,
  storedHash: string
): { isValid: boolean; needsRehash: boolean } {
  if (!storedHash || !password) {
    return { isValid: false, needsRehash: false }
  }

  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':')
    if (parts.length !== 3) return { isValid: false, needsRehash: false }
    const [, salt, expectedHash] = parts
    try {
      const bufA = scryptSync(password, salt, 64)
      const bufB = Buffer.from(expectedHash, 'hex')
      return { isValid: bufA.length === bufB.length && timingSafeEqual(bufA, bufB), needsRehash: false }
    } catch {
      return { isValid: false, needsRehash: false }
    }
  }

  if (LEGACY_SHA256.test(storedHash)) {
    const legacy = createHash('sha256').update(`salt_dsm_${password}`).digest()
    const stored = Buffer.from(storedHash, 'hex')
    const ok = legacy.length === stored.length && timingSafeEqual(legacy, stored)
    return { isValid: ok, needsRehash: ok }
  }

  return { isValid: false, needsRehash: false }
}

export function compteVerrouille(verrouilleJusqua: Date | null | undefined): boolean {
  return Boolean(verrouilleJusqua && verrouilleJusqua.getTime() > Date.now())
}

/** Enregistre un échec de connexion et verrouille le compte au-delà du seuil. */
export async function enregistrerEchec(utilisateurId: string, tentativesActuelles: number) {
  const tentatives = tentativesActuelles + 1
  const verrouiller = tentatives >= MAX_TENTATIVES
  await prisma.utilisateur.update({
    where: { id: utilisateurId },
    data: {
      tentativesEchouees: verrouiller ? 0 : tentatives,
      verrouilleJusqua: verrouiller ? new Date(Date.now() + VERROU_DURATION_MS) : undefined,
    },
  })
  return { verrouille: verrouiller, restantes: Math.max(0, MAX_TENTATIVES - tentatives) }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export type SessionUser = {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
  service: string | null
  role: string
}

export function clientIp(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    null
  )
}

export async function createSession(
  utilisateurId: string,
  userAgent: string | null,
  ipAddress: string | null
) {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await prisma.session.create({
    data: {
      token,
      utilisateurId,
      expiresAt,
      userAgent: userAgent || undefined,
      ipAddress: ipAddress || undefined,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })

  return { token, expiresAt }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      utilisateur: {
        select: {
          id: true,
          matricule: true,
          nom: true,
          prenom: true,
          email: true,
          service: true,
          role: true,
        },
      },
    },
  })

  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  // Un compte passé « hors campagne » après s'être connecté perd l'accès à sa session.
  if (estHorsCampagne(session.utilisateur.role)) return null

  return session.utilisateur
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {})
  }
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user) return null
  // Accès à l'espace d'administration et à toutes les données : ADMIN UNIQUEMENT.
  // Les comptes MANAGER et UTILISATEUR n'ont accès qu'à la page de notation (/evaluer).
  if (user.role !== 'ADMIN') return null
  return user
}

export function normalizeMatricule(raw: string): string {
  return raw.trim().toUpperCase()
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}
