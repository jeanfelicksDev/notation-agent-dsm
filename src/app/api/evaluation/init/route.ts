import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { campagneEnCours, getCampagneOuverte, messageHorsPeriode } from '@/lib/campagne'
import { criteresPourPaire, estEvaluateurManager } from '@/lib/criteres'

export async function GET() {
  try {
    // Session et campagne en parallèle ; la session fournit déjà le profil de l'évaluateur.
    const [evaluateur, campagne] = await Promise.all([getSessionUser(), getCampagneOuverte()])
    if (!evaluateur) {
      return NextResponse.json({ error: 'Session expirée' }, { status: 401 })
    }
    if (evaluateur.role === 'EXTERNE') {
      return NextResponse.json({ redirect: '/qr' })
    }
    if (!campagne) {
      return NextResponse.json(
        { evaluateur, etat: 'aucune_campagne', error: "Aucune campagne d'évaluation n'est ouverte pour le moment." },
        { status: 404 }
      )
    }

    // Les affectations sont définies par l'administration : aucune n'est créée automatiquement ici.
    const [affectations, notes, criteres] = await Promise.all([
      prisma.affectation.findMany({
        where: { evaluateurId: evaluateur.id, campagneId: campagne.id, evalueId: { not: evaluateur.id }, invalidee: false },
        select: {
          id: true, evalueId: true, statut: true, clientInterne: true,
          evalue: {
            select: { id: true, matricule: true, nom: true, prenom: true, service: true, emploi: true },
          },
        },
        orderBy: [{ evalue: { nom: 'asc' } }, { evalue: { prenom: 'asc' } }],
      }),
      prisma.note.findMany({
        where: { evaluateurId: evaluateur.id, campagneId: campagne.id },
        select: { evalueId: true, critereId: true, valeur: true, commentaire: true },
      }),
      prisma.critere.findMany({
        where: { campagneId: campagne.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, libelle: true, description: true, noteMaximale: true, typeEvaluateur: true, typeEvaluateurs: true },
      }),
    ])

    if (affectations.length === 0) {
      return NextResponse.json(
        {
          evaluateur,
          etat: 'aucune_affectation',
          error: "Aucun collaborateur ne vous est attribué pour cette campagne. Contactez l'administrateur si c'est une erreur.",
        },
        { status: 404 }
      )
    }

    // Les critères à noter sont calculés ici, une seule fois, pour chaque collaborateur.
    const affectationsAvecCriteres = affectations.map((a) => ({
      ...a,
      critereIds: criteresPourPaire(criteres, evaluateur, a.evalue, a.clientInterne).map((c) => c.id),
    }))

    return NextResponse.json({
      evaluateur,
      campagne: {
        id: campagne.id,
        libelle: campagne.libelle,
        dateFin: campagne.dateFin,
        ouverte: campagneEnCours(campagne),
        messagePeriode: campagneEnCours(campagne) ? null : messageHorsPeriode(campagne),
      },
      criteres,
      affectations: affectationsAvecCriteres,
      notes,
      isManager: estEvaluateurManager(evaluateur.role),
    })
  } catch (error) {
    console.error('evaluation/init error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
