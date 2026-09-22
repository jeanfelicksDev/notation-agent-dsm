import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const APP_NAME = 'Notation DSM Premium'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

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
          where: {
            statut: { in: ['EN_ATTENTE', 'BROUILLON'] },
          },
          include: {
            evaluateur: true,
            evalue: true,
          },
        },
      },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    if (campagne.affectations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Toutes les évaluations de cette campagne sont déjà finalisées ! Aucune relance nécessaire.',
        count: 0,
      })
    }

    // Grouper les affectations en attente par évaluateur
    const mapByEvaluateur = new Map<
      string,
      {
        evaluateur: (typeof campagne.affectations)[0]['evaluateur']
        evalues: string[]
      }
    >()

    for (const aff of campagne.affectations) {
      const entry = mapByEvaluateur.get(aff.evaluateurId) || {
        evaluateur: aff.evaluateur,
        evalues: [],
      }
      entry.evalues.push(`${aff.evalue.prenom} ${aff.evalue.nom}`)
      mapByEvaluateur.set(aff.evaluateurId, entry)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'http://localhost:3000'
    let sentCount = 0

    for (const [, item] of mapByEvaluateur.entries()) {
      const toEmail = item.evaluateur.email
      const recipientName = `${item.evaluateur.prenom} ${item.evaluateur.nom}`
      const pendingCount = item.evalues.length

      if (resend && toEmail) {
        try {
          await resend.emails.send({
            from: `${APP_NAME} <${FROM_EMAIL}>`,
            to: toEmail,
            subject: `[Rappel] Vos évaluations DSM TAMIS en attente (${campagne.libelle})`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #004180;">Rappel d'évaluation DSM TAMIS</h2>
                <p>Bonjour <strong>${recipientName}</strong>,</p>
                <p>La campagne <strong>${campagne.libelle}</strong> est actuellement en cours et nous constatons que vous avez encore <strong>${pendingCount} évaluation(s) en attente</strong> :</p>
                <ul style="background: #f8fafc; padding: 16px 24px; border-radius: 8px; color: #334155;">
                  ${item.evalues.slice(0, 8).map((name) => `<li>${name}</li>`).join('')}
                  ${item.evalues.length > 8 ? `<li>... et ${item.evalues.length - 8} autre(s)</li>` : ''}
                </ul>
                <p style="margin: 24px 0;">
                  <a href="${appUrl}/evaluer" style="background: #0a84ff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Compléter mes notations
                  </a>
                </p>
                <p style="font-size: 12px; color: #64748b;">Date limite de la campagne : ${new Date(campagne.dateFin).toLocaleDateString('fr-FR')}</p>
              </div>
            `,
          })
          sentCount++
        } catch (e) {
          console.error(`Erreur d'envoi relance email à ${toEmail}:`, e)
        }
      } else {
        // En mode console/dev
        sentCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${sentCount} évaluateur(s) relancé(s) pour un total de ${campagne.affectations.length} évaluation(s) restante(s).`,
      count: sentCount,
      totalPending: campagne.affectations.length,
    })
  } catch (error: any) {
    console.error('Erreur lors des relances:', error)
    return NextResponse.json({ error: 'Erreur serveur lors des relances' }, { status: 500 })
  }
}
