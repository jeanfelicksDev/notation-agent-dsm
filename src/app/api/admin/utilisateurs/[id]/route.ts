import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { codePrisma } from '@/lib/erreurs'
import type { Prisma } from '@prisma/client'
import { normaliserSexe } from '@/lib/agents'
import { requireAdmin, hashPassword, normalizeEmail, normalizeMatricule, pinEstDefini } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id },
    })

    if (!utilisateur) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Un vote client = un client distinct (et non une adresse IP).
    const [votesParClient, moyenne] = await Promise.all([
      prisma.noteClient.groupBy({ by: ['clientId'], where: { agentId: id } }),
      prisma.noteClient.aggregate({ where: { agentId: id }, _avg: { valeur: true } }),
    ])

    const { motDePasse, ...sansHash } = utilisateur
    return NextResponse.json({
      ...sansHash,
      pinDefini: pinEstDefini(motDePasse),
      clientVotesCount: votesParClient.length,
      clientScoreAvg: moyenne._avg.valeur ? Math.round(moyenne._avg.valeur * 10) / 10 : null,
    })
  } catch (error) {
    console.error('API GET Error [utilisateurs/[id]]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

const optionnel = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const actuel = await prisma.utilisateur.findUnique({
      where: { id },
      select: { role: true, qrToken: true },
    })
    if (!actuel) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

    // Seuls les champs réellement envoyés sont modifiés : un formulaire partiel n'efface rien.
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
    const data: Prisma.UtilisateurUpdateInput = {}
    if (has('matricule') && body.matricule) data.matricule = normalizeMatricule(String(body.matricule))
    if (has('nom') && body.nom) data.nom = String(body.nom).trim()
    if (has('prenom') && body.prenom) data.prenom = String(body.prenom).trim()
    if (has('email') && body.email) data.email = normalizeEmail(String(body.email))
    if (has('telephone')) data.telephone = optionnel(body.telephone)
    if (has('service')) data.service = optionnel(body.service)
    if (has('sexe')) data.sexe = normaliserSexe(body.sexe)
    if (has('nationalite')) data.nationalite = optionnel(body.nationalite)
    if (has('emploi')) data.emploi = optionnel(body.emploi)
    if (has('departement')) data.departement = optionnel(body.departement)
    if (has('direction')) data.direction = optionnel(body.direction)

    if (has('role') && body.role && body.role !== actuel.role) {
      if (id === admin.id) {
        return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' }, { status: 400 })
      }
      data.role = body.role
    }

    if (has('qrcodeActif')) {
      data.qrcodeActif = Boolean(body.qrcodeActif)
      if (body.qrcodeActif && !actuel.qrToken) data.qrToken = randomBytes(20).toString('hex')
    }

    // Seul le mot de passe d'un administrateur se modifie ici ; le PIN d'un agent se réinitialise.
    const roleFinal = (data.role as string | undefined) ?? actuel.role
    const mdp = typeof body.motDePasse === 'string' ? body.motDePasse.trim() : ''
    if (mdp) {
      if (roleFinal !== 'ADMIN') {
        return NextResponse.json(
          { error: "Le PIN d'un agent ne se saisit pas : utilisez « Réinitialiser le PIN »." },
          { status: 400 }
        )
      }
      if (mdp.length < 8) {
        return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 })
      }
      data.motDePasse = hashPassword(mdp)
    }

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data,
      select: { id: true, matricule: true, nom: true, prenom: true, role: true },
    })

    return NextResponse.json(utilisateur)
  } catch (error) {
    console.error('API PATCH Error [utilisateurs/[id]]:', error)
    if (codePrisma(error) === 'P2002') {
      return NextResponse.json({ error: 'Ce matricule ou email est déjà utilisé par un autre utilisateur' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await params
  if (id === admin.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 })
  }

  try {
    // Suppression explicite des dépendances (la base peut ne pas avoir les cascades), en une seule transaction.
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { utilisateurId: id } }),
      prisma.otpToken.deleteMany({ where: { utilisateurId: id } }),
      prisma.note.deleteMany({ where: { OR: [{ evaluateurId: id }, { evalueId: id }] } }),
      prisma.noteClient.deleteMany({ where: { OR: [{ agentId: id }, { clientId: id }] } }),
      prisma.scoreFinal.deleteMany({ where: { utilisateurId: id } }),
      prisma.affectation.deleteMany({ where: { OR: [{ evaluateurId: id }, { evalueId: id }] } }),
      prisma.utilisateur.delete({ where: { id } }),
    ])
    return NextResponse.json({ message: 'Utilisateur supprimé avec succès' })
  } catch (error) {
    console.error(`API DELETE Error [utilisateurs/${id}]:`, error)
    if (codePrisma(error) === 'P2025') {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
