import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'

export const SESSION_COOKIE_NAME = 'eval_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 8 // 8 heures
const OTP_DURATION_MS = 1000 * 60 * 5 // 5 minutes
const OTP_MAX_ATTEMPTS = 5

export function generateOtpCode(): string {
  // 6 chiffres, jamais à zéro initial pour rester sur 6 caractères affichés
  const n = 100000 + Math.floor(Math.random() * 900000)
  return String(n)
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(`salt_dsm_${password}`).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!hash) return false
  // Support à la fois le mot de passe hashé et le mot de passe en clair (pour la compatibilité)
  if (hash === password) return true
  return hashPassword(password) === hash
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

export async function createOtpToken(utilisateurId: string, code: string) {
  // Invalider les anciens OTPs non consommés pour cet utilisateur
  await prisma.otpToken.updateMany({
    where: {
      utilisateurId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  })

  return prisma.otpToken.create({
    data: {
      utilisateurId,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_DURATION_MS),
    },
  })
}

export async function verifyOtpCode(
  utilisateurId: string,
  code: string
): Promise<
  | { ok: true }
  | { ok: false; reason: 'expired' | 'invalid' | 'too_many_attempts' | 'not_found' }
> {
  const token = await prisma.otpToken.findFirst({
    where: {
      utilisateurId,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!token) return { ok: false, reason: 'not_found' }

  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' }
  }

  if (token.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  if (hashCode(code) !== token.codeHash) {
    await prisma.otpToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    })
    return { ok: false, reason: 'invalid' }
  }

  await prisma.otpToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  })
  return { ok: true }
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
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') return null
  return user
}

export function normalizeMatricule(raw: string): string {
  return raw.trim().toUpperCase()
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}
