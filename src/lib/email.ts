import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const APP_NAME = 'DSM TAMIS'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

export const emailConfigure = Boolean(resend)

/** Adresses générées à l'import, qui ne correspondent à aucune boîte réelle. */
export function emailEstReel(email: string | null | undefined): email is string {
  return Boolean(email && email.includes('@') && !email.toLowerCase().endsWith('@dsm.local'))
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type Relance = {
  to: string
  prenom: string
  nom: string
  campagne: string
  dateFin: Date
  collaborateurs: string[]
  url: string
}

export async function envoyerRelance(r: Relance): Promise<boolean> {
  if (!resend) {
    console.log(`[DEV relance] ${r.to} — ${r.collaborateurs.length} évaluation(s) en attente`)
    return false
  }

  const liste = r.collaborateurs.slice(0, 8).map((n) => `<li style="margin:4px 0">${escapeHtml(n)}</li>`).join('')
  const reste = r.collaborateurs.length > 8 ? `<li style="margin:4px 0">… et ${r.collaborateurs.length - 8} autre(s)</li>` : ''
  const fin = r.dateFin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const { error } = await resend.emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to: r.to,
    subject: `Rappel : ${r.collaborateurs.length} évaluation(s) à terminer avant le ${fin}`,
    html: `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f4f6f9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#002B49;padding:20px 28px;color:#ffffff;font-weight:600;font-size:15px">DSM <span style="color:#D4AF37">TAMIS</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px">Bonjour ${escapeHtml(r.prenom)} ${escapeHtml(r.nom)},</p>
<p style="margin:0 0 16px;line-height:1.6">Dans le cadre de la campagne <strong>${escapeHtml(r.campagne)}</strong>, il vous reste <strong>${r.collaborateurs.length} évaluation(s)</strong> à terminer :</p>
<ul style="margin:0 0 20px;padding:12px 28px;background:#f4f6f9;border-radius:8px;color:#334155">${liste}${reste}</ul>
<p style="margin:0 0 24px"><a href="${escapeHtml(r.url)}" style="display:inline-block;background:#002B49;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Terminer mes évaluations</a></p>
<p style="margin:0;font-size:13px;color:#64748b">Date limite : ${fin}.</p>
</td></tr></table></td></tr></table></body></html>`,
    text: `Bonjour ${r.prenom} ${r.nom},\n\nCampagne ${r.campagne} : il vous reste ${r.collaborateurs.length} évaluation(s) à terminer avant le ${fin}.\n\n${r.url}`,
  })

  if (error) {
    console.error('Resend error:', error)
    return false
  }
  return true
}
