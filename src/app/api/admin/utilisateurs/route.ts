import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { codePrisma } from '@/lib/erreurs'
import { normaliserSexe } from '@/lib/agents'
import { completerListes, directionParDefaut } from '@/lib/listes-serveur'
import { estRole } from '@/lib/roles'
import { requireAdmin, hashPassword, pinEstDefini, normalizeEmail, normalizeMatricule } from '@/lib/auth'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const utilisateurs = await prisma.utilisateur.findMany({
      select: {
        id: true,
        matricule: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        sexe: true,
        nationalite: true,
        emploi: true,
        service: true,
        departement: true,
        direction: true,
        qrcodeActif: true,
        qrToken: true,
        motDePasse: true,
        verrouilleJusqua: true,
        createdAt: true,
      },
      orderBy: { nom: 'asc' }
    })
    // Le hash ne quitte jamais le serveur : on indique seulement si le PIN est défini.
    return NextResponse.json(
      utilisateurs.map(({ motDePasse, ...u }) => ({ ...u, pinDefini: pinEstDefini(motDePasse) }))
    )
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { matricule, nom, prenom, email, telephone, motDePasse, role, sexe, nationalite, emploi, service, departement, direction, qrcodeActif } = await request.json()

    if (!matricule || !nom || !prenom || !email) {
      return NextResponse.json({ error: 'Tous les champs obligatoires doivent être remplis' }, { status: 400 })
    }

    if (role && !estRole(role)) {
      return NextResponse.json({ error: 'Rôle inconnu' }, { status: 400 })
    }
    const finalRole = role || 'UTILISATEUR'
    const mdp = typeof motDePasse === 'string' ? motDePasse.trim() : ''
    // Un agent choisit lui-même son PIN à la première connexion ; un administrateur a un vrai mot de passe.
    if (finalRole === 'ADMIN' && mdp.length < 8) {
      return NextResponse.json({ error: "Le mot de passe d'un administrateur doit faire au moins 8 caractères" }, { status: 400 })
    }

    const isQrActive = Boolean(qrcodeActif)

    const utilisateur = await prisma.utilisateur.create({
      data: {
        matricule: normalizeMatricule(matricule),
        nom: String(nom).trim(),
        prenom: String(prenom).trim(),
        email: normalizeEmail(email),
        telephone: telephone ? String(telephone).trim() : null,
        motDePasse: finalRole === 'ADMIN' ? hashPassword(mdp) : '',
        role: finalRole,
        sexe: normaliserSexe(sexe),
        nationalite: nationalite || null,
        emploi: emploi || null,
        service: service || null,
        departement: departement || null,
        direction: direction || (await directionParDefaut()),
        qrcodeActif: isQrActive,
        qrToken: isQrActive ? randomBytes(20).toString('hex') : undefined,
      },
      select: { id: true, matricule: true, nom: true, prenom: true, role: true },
    })
    await completerListes([{ nationalite, service, departement, direction }])

    return NextResponse.json(utilisateur)
  } catch (error) {
    console.error('Error:', error)
    if (codePrisma(error) === 'P2002') {
      return NextResponse.json({ error: 'Matricule ou email déjà utilisé' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Action réservée exclusivement aux administrateurs' }, { status: 403 })
  }

  // Garde-fou serveur : l'appelant doit confirmer explicitement la purge.
  const body = await request.json().catch(() => null)
  if (body?.confirmation !== 'SUPPRIMER') {
    return NextResponse.json({ error: 'Confirmation manquante' }, { status: 400 })
  }

  try {
    const result = await prisma.utilisateur.deleteMany({
      where: {
        role: { not: 'ADMIN' },
        id: { not: admin.id },
      }
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Error clearing participants:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression des participants' }, { status: 500 })
  }
}
