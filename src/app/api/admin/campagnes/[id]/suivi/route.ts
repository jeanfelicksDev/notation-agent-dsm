import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    // 1. Fetch all affectations for this campaign
    const affectations = await prisma.affectation.findMany({
      where: { campagneId: id },
      include: {
        evaluateur: {
          select: { id: true, matricule: true, nom: true, prenom: true, role: true, service: true }
        },
        evalue: {
          select: { id: true, matricule: true, nom: true, prenom: true, role: true, service: true }
        }
      }
    })

    // 2. Fetch all NoteClient records for this campaign
    const noteClients = await prisma.noteClient.findMany({
      where: { campagneId: id },
      include: {
        agent: {
          select: { id: true, matricule: true, nom: true, prenom: true, service: true }
        },
        critere: {
          select: { id: true, libelle: true, noteMaximale: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Group noteClients by clientId + agentId to represent each completed client evaluation
    const clientEvaluationsMap = new Map<string, any>()
    for (const nc of noteClients) {
      const key = `${nc.clientId || 'anon'}_${nc.agentId}`
      if (!clientEvaluationsMap.has(key)) {
        // Fetch client user info if clientId exists
        clientEvaluationsMap.set(key, {
          clientId: nc.clientId,
          agentId: nc.agentId,
          agent: nc.agent,
          notes: [],
          createdAt: nc.createdAt
        })
      }
      clientEvaluationsMap.get(key).notes.push({
        critere: nc.critere.libelle,
        valeur: nc.valeur,
        noteMaximale: nc.critere.noteMaximale,
        // Pas de commentaire ici : il serait rattaché au nom du client. Voir /admin/retours.
      })
    }

    // Get client user details for external evaluations
    const clientIds = [...new Set([...clientEvaluationsMap.values()].map(c => c.clientId).filter(Boolean))]
    const clientUsers = await prisma.utilisateur.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, nom: true, prenom: true, telephone: true, matricule: true, role: true }
    })
    const clientUserMap = new Map(clientUsers.map(u => [u.id, u]))

    const clientEvaluationsList = [...clientEvaluationsMap.values()].map(item => {
      const clientUser = item.clientId ? clientUserMap.get(item.clientId) : null
      const totalNotes = item.notes.reduce((sum: number, n: any) => sum + n.valeur, 0)
      const avg = item.notes.length > 0 ? (totalNotes / item.notes.length).toFixed(1) : '-'

      return {
        id: `${item.clientId}_${item.agentId}`,
        client: clientUser || { nom: 'Client Externe', prenom: '', telephone: item.clientId, matricule: item.clientId },
        agent: item.agent,
        criteresCount: item.notes.length,
        moyenne: avg,
        notes: item.notes,
        createdAt: item.createdAt,
        statut: 'TERMINEE'
      }
    })

    // 3. Group internal evaluators from affectations (where evaluateur.role !== 'EXTERNE')
    const internalAffectations = affectations.filter(a => a.evaluateur.role !== 'EXTERNE')
    const internalEvalMap = new Map<string, any>()

    for (const aff of internalAffectations) {
      if (!internalEvalMap.has(aff.evaluateurId)) {
        internalEvalMap.set(aff.evaluateurId, {
          user: aff.evaluateur,
          affectations: []
        })
      }
      internalEvalMap.get(aff.evaluateurId).affectations.push(aff)
    }

    const internalTrackingList = [...internalEvalMap.values()].map(item => {
      const totalToEvaluate = item.affectations.length
      const terminees = item.affectations.filter((a: any) => a.statut === 'TERMINEE').length
      const brouillons = item.affectations.filter((a: any) => a.statut === 'BROUILLON').length

      // « Terminé » seulement si TOUTES les évaluations de l'évaluateur sont soumises.
      let statut = 'EN_ATTENTE'
      if (terminees === totalToEvaluate) statut = 'TERMINEE'
      else if (terminees > 0 || brouillons > 0) statut = 'BROUILLON'

      return {
        user: item.user,
        statut,
        totalToEvaluate,
        terminees,
        affectations: item.affectations
      }
    })

    // 4. Overall counts
    const internalTerminees = internalTrackingList.filter(d => d.statut === 'TERMINEE').length
    const internalBrouillons = internalTrackingList.filter(d => d.statut === 'BROUILLON').length
    const internalAttente = internalTrackingList.filter(d => d.statut === 'EN_ATTENTE').length
    const totalClientsCount = clientEvaluationsList.length

    const countTerminee = internalTerminees + totalClientsCount
    const countBrouillon = internalBrouillons
    const countAttente = internalAttente
    const total = internalTrackingList.length + totalClientsCount

    return NextResponse.json({
      success: true,
      stats: {
        total,
        countTerminee,
        countBrouillon,
        countAttente,
        internalTerminees,
        totalClientsCount
      },
      internes: internalTrackingList,
      clientsQr: clientEvaluationsList,
      affectations
    })
  } catch (error: any) {
    console.error('Error fetching suivi data:', error)
    return NextResponse.json({ error: 'Erreur lors du chargement du suivi' }, { status: 500 })
  }
}
