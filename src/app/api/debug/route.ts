import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  // Protection de sécurité : réservé aux administrateurs connectés
  const admin = await requireAdmin()
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
  }

  const url = process.env.DATABASE_URL

  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL not set', hint: 'Add DATABASE_URL to Vercel env vars' })
  }

  const masked = url.replace(/\/\/.+@/, '//***@').replace(/:(\d+)\//, ':$1/')

  return NextResponse.json({
    status: 'ok',
    DATABASE_URL_set: true,
    format_hint: url.startsWith('postgresql://') || url.startsWith('postgres://') ? 'ok' : 'invalid prefix',
    masked_url: masked,
    node_version: process.version,
  })
}