import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { estEvaluateurManager } from '@/lib/criteres'
import { empreinte } from '@/lib/commentaires'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Le détail nominatif des notes est réservé aux administrateurs.
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const campagneId = searchParams.get('campagneId')

    // Trouver la campagne cible
    let campagne
    if (campagneId?.startsWith('ANNUEL_')) {
      return NextResponse.json({ error: 'Pas de détails pour le palmarès annuel' }, { status: 404 })
    } else if (campagneId) {
      campagne = await prisma.campagne.findUnique({ where: { id: campagneId } })
    } else {
      campagne =
        (await prisma.campagne.findFirst({ where: { statut: 'CALCULEE' }, orderBy: { createdAt: 'desc' } })) ||
        (await prisma.campagne.findFirst({ where: { statut: 'OUVERTE' }, orderBy: { createdAt: 'desc' } })) ||
        (await prisma.campagne.findFirst({ orderBy: { createdAt: 'desc' } }))
    }

    if (!campagne) {
      return NextResponse.json({ error: 'Aucune campagne trouvée' }, { status: 404 })
    }

    // Notes internes (collègues + manager). L'identité des évaluateurs ne quitte pas le serveur.
    const notesInternes = await prisma.note.findMany({
      where: { evalueId: userId, campagneId: campagne.id },
      select: {
        evaluateurId: true,
        critereId: true,
        valeur: true,
        evaluateur: { select: { role: true } },
        critere: {
          select: { id: true, libelle: true, noteMaximale: true, typeEvaluateur: true, typeEvaluateurs: true },
        },
      },
    })

    // Récupérer les notes clients
    const notesClients = await prisma.noteClient.findMany({
      where: { agentId: userId, campagneId: campagne.id },
      include: {
        critere: {
          select: { id: true, libelle: true, noteMaximale: true, typeEvaluateur: true, typeEvaluateurs: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Récupérer les critères de la campagne (pour avoir la liste complète)
    const criteres = await prisma.critere.findMany({
      where: { campagneId: campagne.id },
      orderBy: { createdAt: 'asc' },
    })

    // Grouper les notes internes par évaluateur, sans son identité ni ses commentaires
    // (les commentaires se lisent, anonymisés, dans la fiche de retours).
    const evaluateurMap = new Map<
      string,
      {
        estManager: boolean
        notes: Array<{ critereId: string; critereLibelle: string; noteMaximale: number; valeur: number; typeEvaluateur: string; typeEvaluateurs?: string[] }>
      }
    >()

    for (const note of notesInternes) {
      const entree = evaluateurMap.get(note.evaluateurId) ?? { estManager: estEvaluateurManager(note.evaluateur.role), notes: [] }
      entree.notes.push({
        critereId: note.critereId,
        critereLibelle: note.critere.libelle,
        noteMaximale: note.critere.noteMaximale,
        valeur: note.valeur,
        typeEvaluateur: note.critere.typeEvaluateur,
        typeEvaluateurs: note.critere.typeEvaluateurs,
      })
      evaluateurMap.set(note.evaluateurId, entree)
    }

    // Statut de chaque évaluation : seules les évaluations soumises comptent dans le score.
    const affectations = await prisma.affectation.findMany({
      where: { evalueId: userId, campagneId: campagne.id },
      select: { evaluateurId: true, statut: true },
    })
    const statutPar = new Map(affectations.map((a) => [a.evaluateurId, a.statut]))

    // Ordre mélangé (stable) puis numérotation : l'ordre alphabétique ne trahit personne.
    let numero = 0
    let numeroManager = 0
    const plusieursManagers = [...evaluateurMap.values()].filter((e) => e.estManager).length > 1
    const evaluateursNotes = [...evaluateurMap.entries()]
      .sort(([a], [b]) => empreinte(`${campagne.id}:${userId}:${a}`) - empreinte(`${campagne.id}:${userId}:${b}`))
      .map(([evaluateurId, e]) => ({
        libelle: e.estManager ? (plusieursManagers ? `Manager ${++numeroManager}` : 'Manager') : `Évaluateur ${++numero}`,
        estManager: e.estManager,
        soumis: statutPar.get(evaluateurId) === 'TERMINEE',
        notes: e.notes,
      }))

    // Grouper les notes clients par client (ipHash ou clientId)
    const clientMap = new Map<
      string,
      { notes: Array<{ critereId: string; critereLibelle: string; noteMaximale: number; valeur: number }> }
    >()

    for (const nc of notesClients) {
      const key = nc.clientId || nc.ipHash || nc.id
      if (!clientMap.has(key)) {
        clientMap.set(key, { notes: [] })
      }
      clientMap.get(key)!.notes.push({
        critereId: nc.critereId,
        critereLibelle: nc.critere.libelle,
        noteMaximale: nc.critere.noteMaximale,
        valeur: nc.valeur,
      })
    }

    const clientsNotes = Array.from(clientMap.entries()).map(([key, val], idx) => ({
      clientLabel: `Client ${idx + 1}`,
      notes: val.notes,
    }))

    return NextResponse.json({
      campagneLibelle: campagne.libelle,
      criteres: criteres.map((c) => ({
        id: c.id,
        libelle: c.libelle,
        noteMaximale: c.noteMaximale,
        typeEvaluateur: c.typeEvaluateur,
        typeEvaluateurs: c.typeEvaluateurs,
      })),
      evaluateursNotes,
      clientsNotes,
    })
  } catch (error) {
    console.error('Error fetching detailed notes:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
