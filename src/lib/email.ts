import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const APP_NAME = 'Notation DSM Premium'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

export type SendOtpResult =
  | { success: true; channel: 'email' | 'console' }
  | { success: false; error: string }

export async function sendOtpEmail(
  to: string,
  code: string,
  recipientName: string
): Promise<SendOtpResult> {
  if (!resend) {
    console.log('\n========================================')
    console.log(`[DEV OTP] À envoyer à : ${to}`)
    console.log(`[DEV OTP] Destinataire : ${recipientName}`)
    console.log(`[DEV OTP] Code : ${code}`)
    console.log('========================================\n')
    return { success: true, channel: 'console' }
  }

  try {
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to,
      subject: `Votre code de connexion : ${code}`,
      html: buildOtpEmailHtml(code, recipientName),
      text: buildOtpEmailText(code, recipientName),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: error.message || 'Échec de l\'envoi' }
    }

    return { success: true, channel: 'email' }
  } catch (err) {
    console.error('sendOtpEmail exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    }
  }
}

function buildOtpEmailHtml(code: string, recipientName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Code de connexion</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:40px 40px 24px 40px;text-align:center;">
              <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#dc2626;text-transform:uppercase;margin-bottom:8px;">${APP_NAME}</div>
              <h1 style="margin:0;font-size:24px;color:#0f172a;font-weight:800;">Code de vérification</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;color:#475569;font-size:15px;line-height:1.6;">
              Bonjour <strong>${escapeHtml(recipientName)}</strong>,<br><br>
              Voici votre code de connexion à la plateforme d'évaluation 360°.
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;text-align:center;">
              <div style="display:inline-block;background:#fef2f2;border:2px solid #fecaca;border-radius:16px;padding:24px 40px;">
                <div style="font-family:'SF Mono','Roboto Mono',monospace;font-size:42px;font-weight:800;letter-spacing:12px;color:#dc2626;">${code}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;color:#64748b;font-size:13px;line-height:1.6;">
              Ce code est valable pendant <strong>5 minutes</strong>.<br>
              Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;font-size:12px;color:#94a3b8;">
              Ne partagez ce code avec personne. L'équipe ${APP_NAME} ne vous le demandera jamais.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildOtpEmailText(code: string, recipientName: string): string {
  return `Bonjour ${recipientName},

Votre code de connexion à ${APP_NAME} est : ${code}

Ce code est valable pendant 5 minutes.
Ne le partagez avec personne.

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
