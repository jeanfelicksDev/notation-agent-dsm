import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser || (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'MANAGER')) {
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

    // Récupérer les notes internes (collègues + manager)
    const notesInternes = await prisma.note.findMany({
      where: { evalueId: userId, campagneId: campagne.id },
      include: {
        evaluateur: {
          select: { id: true, nom: true, prenom: true, matricule: true, role: true, service: true },
        },
        critere: {
          select: { id: true, libelle: true, noteMaximale: true, typeEvaluateur: true, typeEvaluateurs: true },
        },
      },
      orderBy: [{ critere: { typeEvaluateur: 'asc' } }, { evaluateur: { nom: 'asc' } }],
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

    // Grouper les notes internes par évaluateur
    const evaluateurMap = new Map<
      string,
      {
        evaluateur: { id: string; nom: string; prenom: string; matricule: string; role: string; service: string | null }
        notes: Array<{ critereId: string; critereLibelle: string; noteMaximale: number; valeur: number; commentaire: string | null; typeEvaluateur: string; typeEvaluateurs?: string[] }>
      }
    >()

    for (const note of notesInternes) {
      const key = note.evaluateurId
      if (!evaluateurMap.has(key)) {
        evaluateurMap.set(key, { evaluateur: note.evaluateur, notes: [] })
      }
      evaluateurMap.get(key)!.notes.push({
        critereId: note.critereId,
        critereLibelle: note.critere.libelle,
        noteMaximale: note.critere.noteMaximale,
        valeur: note.valeur,
        commentaire: note.commentaire,
        typeEvaluateur: note.critere.typeEvaluateur,
        typeEvaluateurs: note.critere.typeEvaluateurs,
      })
    }

    const evaluateursNotes = Array.from(evaluateurMap.values())

    // Grouper les notes clients par client (ipHash ou clientId)
    const clientMap = new Map<
      string,
      { notes: Array<{ critereId: string; critereLibelle: string; noteMaximale: number; valeur: number; commentaire: string | null }> }
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
        commentaire: nc.commentaire,
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
