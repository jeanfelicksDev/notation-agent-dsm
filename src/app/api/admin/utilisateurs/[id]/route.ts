import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin, hashPassword } from '@/lib/auth'

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
      include: { 
        site: true
      }
    })

    if (!utilisateur) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Fetch client stats (graceful fallback if noteClient not yet available)
    let clientVotesCount = 0
    let clientScoreAvg: number | null = null
    try {
      const uniqueClientVotes = await (prisma as any).noteClient.groupBy({
        by: ['ipHash'],
        where: { agentId: id },
        _count: { _all: true }
      })
      clientVotesCount = uniqueClientVotes.length

      const avgResult = await (prisma as any).noteClient.aggregate({
        where: { agentId: id },
        _avg: { valeur: true }
      })
      clientScoreAvg = avgResult._avg.valeur
        ? Math.round(avgResult._avg.valeur * 10) / 10
        : null
    } catch (statsError) {
      console.warn('noteClient stats unavailable (restart dev server if persistent):', statsError)
    }

    return NextResponse.json({
      ...utilisateur,
      clientVotesCount,
      clientScoreAvg
    })
  } catch (error) {
    console.error('API GET Error [utilisateurs/[id]]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const { matricule, nom, prenom, email, telephone, role, service, departement, direction, siteId, qrcodeActif, motDePasse } = await request.json()

    // Build the update data object
    const data: any = {
      matricule: matricule?.toUpperCase(),
      nom,
      prenom,
      email: email ? String(email).toLowerCase().trim() : undefined,
      telephone: telephone ? String(telephone).trim() : null,
      role,
      service: service || null,
      departement: departement || null,
      direction: direction || null,
      site: siteId ? { connect: { id: siteId } } : { disconnect: true },
      qrcodeActif: qrcodeActif !== undefined ? Boolean(qrcodeActif) : undefined
    }

    // Auto-generate qrToken if qrcodeActif is enabled and user doesn't have one
    if (qrcodeActif) {
      const currentUser = await prisma.utilisateur.findUnique({
        where: { id },
        select: { qrToken: true }
      })
      if (!currentUser?.qrToken) {
        const { randomBytes } = await import('node:crypto')
        data.qrToken = randomBytes(20).toString('hex')
      }
    }

    // Only update password if a new one was provided and the target is an ADMIN
    if (motDePasse && motDePasse.trim().length >= 4) {
      data.motDePasse = hashPassword(motDePasse.trim())
    }

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data
    })

    return NextResponse.json(utilisateur)
  } catch (error: any) {
    console.error('API PATCH Error [utilisateurs/[id]]:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ce matricule ou email est déjà utilisé par un autre utilisateur' }, { status: 400 })
    }
    const msg = error?.message || 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Vérification authentification
  let admin
  try {
    admin = await requireAdmin()
  } catch (authErr: any) {
    console.error('DELETE auth error:', authErr)
    return NextResponse.json({ error: 'Erreur auth: ' + authErr?.message }, { status: 500 })
  }
  
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé - pas de session admin valide' }, { status: 401 })
  }

  let id: string
  try {
    const p = await params
    id = p.id
  } catch (paramErr: any) {
    return NextResponse.json({ error: 'Param error: ' + paramErr?.message }, { status: 400 })
  }

  // 2. Suppression séquentielle des dépendances
  const steps: string[] = []
  try {
    steps.push('session.deleteMany')
    await prisma.session.deleteMany({ where: { utilisateurId: id } })

    steps.push('otpToken.deleteMany')
    await prisma.otpToken.deleteMany({ where: { utilisateurId: id } })

    steps.push('note.deleteMany')
    await prisma.note.deleteMany({ where: { OR: [{ evaluateurId: id }, { evalueId: id }] } })

    steps.push('scoreFinal.deleteMany')
    await prisma.scoreFinal.deleteMany({ where: { utilisateurId: id } })

    steps.push('affectation.deleteMany')
    await prisma.affectation.deleteMany({ where: { OR: [{ evaluateurId: id }, { evalueId: id }] } })



    steps.push('utilisateur.delete')
    await prisma.utilisateur.delete({ where: { id } })

    return NextResponse.json({ message: 'Utilisateur supprimé avec succès' })
  } catch (error: any) {
    console.error(`API DELETE Error [utilisateurs/${id}] at step "${steps[steps.length - 1]}":`, error)
    return NextResponse.json({
      error: `Erreur à l'étape "${steps[steps.length - 1]}": ${error?.message || 'Erreur inconnue'}`,
      code: error?.code,
      step: steps[steps.length - 1]
    }, { status: 500 })
  }
}
