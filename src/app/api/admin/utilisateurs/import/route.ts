import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)

    let createdCount = 0
    let updatedCount = 0

    for (const row of rows as any[]) {
      const matricule = row['Matricule']?.toString().trim()
      if (!matricule) continue

      const nom = row['Nom']?.toString().trim() || ''
      const prenom = row['Prénoms']?.toString().trim() || ''
      const service = row['Service']?.toString().trim() || ''
      const siteNom = row['Site']?.toString().trim() || 'Siège'
      const statusRaw = row['Status (Collègues/Manager/Externe)']?.toString().trim().toUpperCase() || ''

      let role = 'UTILISATEUR'
      if (statusRaw.includes('MANAGER')) role = 'MANAGER'
      else if (statusRaw.includes('EXTERNE') || statusRaw.includes('CLIENT')) role = 'EXTERNE'

      // Find or create Site
      let site = await prisma.site.findUnique({ where: { nom: siteNom } })
      if (!site) {
        site = await prisma.site.create({ data: { nom: siteNom } })
      }

      // Upsert User
      const user = await prisma.utilisateur.upsert({
        where: { matricule },
        update: {
          nom,
          prenom,
          service,
          role: role as any,
          siteId: site.id
        },
        create: {
          matricule,
          nom,
          prenom,
          email: `${matricule.toLowerCase()}@dsm.com`,
          motDePasse: '123456', // Default password
          service,
          role: role as any,
          siteId: site.id
        }
      })

      // Check if it was an update or create (approximated)
      // In a real scenario, we might want to check the createdAt vs updatedAt or return from upsert
      createdCount++ // Simplification for feedback
    }

    return NextResponse.json({ 
      success: true, 
      message: `${createdCount} participants traités avec succès.` 
    })

  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'importation: ' + error.message }, { status: 500 })
  }
}
