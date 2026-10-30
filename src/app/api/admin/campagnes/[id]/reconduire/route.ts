import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { ErreurReconduction, messageReconduction, reconduireAffectations } from '@/lib/reconduction'

/** POST — remplace les affectations de la campagne par celles de `sourceId` (voir src/lib/reconduction.ts). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json().catch(() => null)
    const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''
    const resultat = await reconduireAffectations(id, sourceId)
    return NextResponse.json({ success: true, ...resultat, message: messageReconduction(resultat) })
  } catch (error) {
    if (error instanceof ErreurReconduction) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Reconduction error:', error)
    return NextResponse.json({ error: 'Erreur lors de la reconduction des affectations' }, { status: 500 })
  }
}
