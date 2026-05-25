import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.DATABASE_URL

  if (!url) {
    return NextResponse.json({ error: 'DATABASE_URL not set', hint: 'Add DATABASE_URL to Vercel env vars' })
  }

  const masked = url.replace(/\/\/.+@/, '//***@').replace(/:(\d+)\//, ':$1/')

  return NextResponse.json({
    DATABASE_URL_set: true,
    format_hint: url.startsWith('postgresql://') || url.startsWith('postgres://') ? 'ok' : 'invalid prefix',
    masked_url: masked,
    node_version: process.version,
  })
}