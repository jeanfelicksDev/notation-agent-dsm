import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import * as XLSX from 'xlsx'

function getFieldValue(row: any, fieldKeys: string[]): string {
  for (const key of fieldKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim()
    }
  }
  return ''
}

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
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet)

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Fichier vide ou format non reconnu' }, { status: 400 })
    }

    let processedCount = 0

    // PASS 1: Create or Update users and sites
    for (const row of rows) {
      const nom = getFieldValue(row, ['Nom', 'Nom *', 'NOM', 'nom']) || 'SansNom'
      const prenom = getFieldValue(row, ['Prénom', 'Prenom', 'Prénom *', 'Prénoms', 'Prénoms *', 'PRENOM', 'prenom']) || ''
      
      const statusRaw = getFieldValue(row, [
        'Statut',
        'STATUT',
        'statut',
        'Statut [Agent ou Manager]',
        'Statut\n[Agent ou Manager]',
        'Statut\r\n[Agent ou Manager]',
        'Rôle Système',
        'Role Systeme',
        'Rôle',
        'Role',
        'Status'
      ]).toUpperCase()

      let role: 'ADMIN' | 'MANAGER' | 'UTILISATEUR' | 'EXTERNE' = 'UTILISATEUR'
      if (statusRaw.includes('ADMIN')) role = 'ADMIN'
      else if (statusRaw.includes('MANAGER')) role = 'MANAGER'
      else if (statusRaw.includes('EXTERNE') || statusRaw.includes('CLIENT')) role = 'EXTERNE'

      const matriculeOrTel = getFieldValue(row, [
        'Matricule/Tel',
        'Matricule / Tel',
        'Matricule/tel',
        'Matricule / tel',
        'Matricule/Tel.',
        'Matricule',
        'MATRICULE',
        'matricule',
        'Matricule *',
        'Téléphone (client externe)',
        'Telephone (client externe)',
        'Téléphone',
        'Telephone',
        'Tel',
        'Matricule(collaborateurs)\nTéléphone(client externe)',
        'Matricule(collaborateurs)\r\nTéléphone(client externe)',
        'Matricule(collaborateurs) Téléphone(client externe)',
        'Matricule(collaborateurs)',
      ])

      if (!matriculeOrTel) continue

      const finalMatricule = matriculeOrTel
      const telephoneValue = role === 'EXTERNE' 
        ? matriculeOrTel 
        : (getFieldValue(row, ['Téléphone', 'Telephone', 'Tel', 'Téléphone (client externe)', 'Telephone (client externe)']) || undefined)

      let email = getFieldValue(row, ['Email *', 'Email', 'EMAIL', 'email', 'E-mail'])
      if (!email) {
        const cleanMatricule = finalMatricule.toLowerCase().replace(/[^a-z0-9]/g, '')
        email = `${cleanMatricule || 'user-' + Date.now()}@dsm.local`
      }

      const service = getFieldValue(row, ['Service', 'SERVICE', 'service', 'Service / Département'])
      
      const departement = getFieldValue(row, [
        'Département',
        'Departement',
        'DEPARTEMENT',
        'departement',
        'Département (Dsm/Manut/Entrepot)',
        'Departement (Dsm/Manut/Entrepot)',
        'Département\n(Dsm/Manut/Entrepot)',
        'Département\r\n(Dsm/Manut/Entrepot)',
      ])

      const direction = getFieldValue(row, [
        'Direction',
        'DIRECTION',
        'direction'
      ])

      const siteNom = departement || direction || 'Siège'

      // Find or create Site
      let site = await prisma.site.findUnique({ where: { nom: siteNom } })
      if (!site) {
        site = await prisma.site.create({ data: { nom: siteNom } })
      }

      // Upsert User
      await prisma.utilisateur.upsert({
        where: { matricule: finalMatricule },
        update: {
          nom,
          prenom,
          email,
          service,
          departement,
          direction,
          role,
          site: { connect: { id: site.id } },
          telephone: telephoneValue,
        },
        create: {
          matricule: finalMatricule,
          nom,
          prenom,
          email,
          motDePasse: '123456', // Default password
          service,
          departement,
          direction,
          role,
          site: { connect: { id: site.id } },
          telephone: telephoneValue,
        },
      })

      processedCount++
    }

    return NextResponse.json({ 
      success: true, 
      message: `${processedCount} participants importés / mis à jour.` 
    })

  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'importation: ' + error.message }, { status: 500 })
  }
}
