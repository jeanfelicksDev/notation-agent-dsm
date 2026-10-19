import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { emailConfigure, emailEstReel, envoyerRelance } from '@/lib/email'

/** POST — relance par email les évaluateurs internes qui n'ont pas soumis leurs évaluations. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params

  try {
    const campagne = await prisma.campagne.findUnique({
      where: { id },
      include: {
        affectations: {
          where: { statut: { in: ['EN_ATTENTE', 'BROUILLON'] }, evaluateur: { role: { not: 'EXTERNE' } } },
          include: {
            evaluateur: { select: { id: true, email: true, prenom: true, nom: true } },
            evalue: { select: { prenom: true, nom: true } },
          },
        },
      },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }
    if (campagne.statut !== 'OUVERTE') {
      return NextResponse.json({ error: 'Les relances ne concernent que la campagne ouverte.' }, { status: 400 })
    }
    if (campagne.affectations.length === 0) {
      return NextResponse.json({ success: true, message: 'Toutes les évaluations sont soumises : aucune relance nécessaire.', count: 0 })
    }
    if (!emailConfigure) {
      return NextResponse.json(
        { error: "L'envoi d'emails n'est pas configuré (RESEND_API_KEY manquante). Aucune relance n'a été envoyée." },
        { status: 503 }
      )
    }

    const parEvaluateur = new Map<string, { evaluateur: (typeof campagne.affectations)[0]['evaluateur']; noms: string[] }>()
    for (const a of campagne.affectations) {
      const entree = parEvaluateur.get(a.evaluateurId) ?? { evaluateur: a.evaluateur, noms: [] }
      entree.noms.push(`${a.evalue.prenom} ${a.evalue.nom}`)
      parEvaluateur.set(a.evaluateurId, entree)
    }

    const url = `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/evaluer`
    let envoyes = 0
    let sansEmail = 0
    let echecs = 0

    for (const { evaluateur, noms } of parEvaluateur.values()) {
      if (!emailEstReel(evaluateur.email)) {
        sansEmail++
        continue
      }
      const ok = await envoyerRelance({
        to: evaluateur.email,
        prenom: evaluateur.prenom,
        nom: evaluateur.nom,
        campagne: campagne.libelle,
        dateFin: campagne.dateFin,
        collaborateurs: noms,
        url,
      }).catch(() => false)
      if (ok) envoyes++
      else echecs++
    }

    const details = [`${envoyes} évaluateur(s) relancé(s)`]
    if (sansEmail) details.push(`${sansEmail} sans adresse email valide`)
    if (echecs) details.push(`${echecs} envoi(s) en échec`)

    return NextResponse.json({ success: true, message: `${details.join(', ')}.`, count: envoyes, sansEmail, echecs })
  } catch (error) {
    console.error('Erreur lors des relances:', error)
    return NextResponse.json({ error: 'Erreur serveur lors des relances' }, { status: 500 })
  }
}
