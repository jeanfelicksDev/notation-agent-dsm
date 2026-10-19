import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { validerPoids } from '@/lib/campagne'
import { enregistrerScores } from '@/lib/scores'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const campagne = await prisma.campagne.findUnique({
      where: { id },
      include: {
        criteres: { orderBy: { createdAt: 'asc' } },
        scores: {
          include: {
            utilisateur: true
          },
          orderBy: { scoreTotal: 'desc' }
        },
        _count: { select: { affectations: true, notes: true } }
      }
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Campagne non trouvée' }, { status: 404 })
    }

    return NextResponse.json(campagne)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

const STATUTS = new Set(['OUVERTE', 'CLOTUREE', 'CALCULEE'])

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

    const actuelle = await prisma.campagne.findUnique({ where: { id } })
    if (!actuelle) return NextResponse.json({ error: 'Campagne non trouvée' }, { status: 404 })

    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
    const data: Prisma.CampagneUpdateInput = {}

    if (has('libelle')) {
      const libelle = String(body.libelle ?? '').trim()
      if (!libelle) return NextResponse.json({ error: 'Le libellé ne peut pas être vide.' }, { status: 400 })
      data.libelle = libelle
    }
    for (const k of ['dateDebut', 'dateFin'] as const) {
      if (has(k) && body[k]) {
        const d = new Date(body[k])
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
        data[k] = d
      }
    }
    const debut = (data.dateDebut as Date | undefined) ?? actuelle.dateDebut
    const fin = (data.dateFin as Date | undefined) ?? actuelle.dateFin
    if (fin < debut) {
      return NextResponse.json({ error: 'La date de fin doit suivre la date de début.' }, { status: 400 })
    }

    if (has('poidsCollegues') || has('poidsManager') || has('poidsClient')) {
      const poids = {
        poidsCollegues: has('poidsCollegues') ? Number(body.poidsCollegues) : actuelle.poidsCollegues,
        poidsManager: has('poidsManager') ? Number(body.poidsManager) : actuelle.poidsManager,
        poidsClient: has('poidsClient') ? Number(body.poidsClient) : actuelle.poidsClient,
      }
      const erreur = validerPoids(poids)
      if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
      Object.assign(data, poids)
    }

    for (const k of ['prixDirection', 'prixDepartement', 'prixService', 'prixGlobal'] as const) {
      if (has(k)) data[k] = typeof body[k] === 'string' && body[k].trim() ? body[k].trim() : null
    }

    let statut: string | undefined
    if (has('statut') && body.statut !== actuelle.statut) {
      if (!STATUTS.has(body.statut)) return NextResponse.json({ error: 'Statut inconnu.' }, { status: 400 })
      statut = body.statut
      if (statut === 'OUVERTE') {
        const autre = await prisma.campagne.findFirst({
          where: { statut: 'OUVERTE', id: { not: id } },
          select: { libelle: true },
        })
        if (autre) {
          return NextResponse.json(
            { error: `La campagne « ${autre.libelle} » est déjà ouverte. Clôturez-la avant d'en ouvrir une autre.` },
            { status: 409 }
          )
        }
      }
      data.statut = statut as Prisma.CampagneUpdateInput['statut']
    }

    const campagne = await prisma.campagne.update({ where: { id }, data })

    // À la clôture, le classement est figé : les scores sont calculés et enregistrés.
    if (statut === 'CLOTUREE') {
      await enregistrerScores(id)
      return NextResponse.json(await prisma.campagne.update({ where: { id }, data: { statut: 'CALCULEE' } }))
    }

    return NextResponse.json(campagne)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Action réservée exclusivement aux administrateurs' }, { status: 403 })
  }

  try {
    const { id } = await params
    // Suppression explicite des données liées, en une transaction (la base peut ne pas avoir les cascades).
    await prisma.$transaction([
      prisma.noteClient.deleteMany({ where: { campagneId: id } }),
      prisma.note.deleteMany({ where: { campagneId: id } }),
      prisma.scoreFinal.deleteMany({ where: { campagneId: id } }),
      prisma.affectation.deleteMany({ where: { campagneId: id } }),
      prisma.critere.deleteMany({ where: { campagneId: id } }),
      prisma.campagne.delete({ where: { id } }),
    ])

    return NextResponse.json({ message: 'Campagne supprimée avec succès' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
