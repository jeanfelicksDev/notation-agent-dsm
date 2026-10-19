import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { codePrisma } from '@/lib/erreurs'
import { normalizeMatricule, requireAdmin } from '@/lib/auth'
import * as XLSX from 'xlsx'

function getFieldValue(row: Record<string, unknown>, fieldKeys: string[]): string {
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
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Fichier vide ou format non reconnu' }, { status: 400 })
    }

    let crees = 0
    let misAJour = 0
    let ignores = 0
    const erreurs: string[] = []
    const sitesCache = new Map<string, { id: string }>()

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

      if (!matriculeOrTel) {
        ignores++
        continue
      }

      const finalMatricule = normalizeMatricule(matriculeOrTel)
      const telephoneValue = role === 'EXTERNE'
        ? matriculeOrTel
        : (getFieldValue(row, ['Téléphone', 'Telephone', 'Tel', 'Téléphone (client externe)', 'Telephone (client externe)']) || undefined)

      const emailFourni = getFieldValue(row, ['Email *', 'Email', 'EMAIL', 'email', 'E-mail']).toLowerCase()
      const emailParDefaut = `${finalMatricule.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user-' + Date.now()}@dsm.local`

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

      // Une colonne « Site » explicite prime ; à défaut on garde l'ancien regroupement.
      const siteNom = getFieldValue(row, ['Site', 'SITE', 'site', 'Localisation']) || departement || direction || 'Siège'

      let site = sitesCache.get(siteNom)
      if (!site) {
        site = await prisma.site.upsert({ where: { nom: siteNom }, update: {}, create: { nom: siteNom } })
        sitesCache.set(siteNom, site)
      }

      try {
        const existant = await prisma.utilisateur.findFirst({
          where: { matricule: { equals: finalMatricule, mode: 'insensitive' } },
          select: { id: true, role: true },
        })

        if (existant) {
          await prisma.utilisateur.update({
            where: { id: existant.id },
            data: {
              nom,
              prenom,
              // On n'écrase jamais un email réel par un email généré.
              ...(emailFourni ? { email: emailFourni } : {}),
              service: service || null,
              departement: departement || null,
              direction: direction || null,
              // Un administrateur n'est jamais rétrogradé par un import.
              ...(existant.role === 'ADMIN' ? {} : { role }),
              site: { connect: { id: site.id } },
              ...(telephoneValue ? { telephone: telephoneValue } : {}),
            },
          })
          misAJour++
        } else {
          await prisma.utilisateur.create({
            data: {
              matricule: finalMatricule,
              nom,
              prenom,
              email: emailFourni || emailParDefaut,
              motDePasse: '', // PIN à définir par l'agent à sa première connexion
              service: service || null,
              departement: departement || null,
              direction: direction || null,
              role: role === 'ADMIN' ? 'UTILISATEUR' : role,
              site: { connect: { id: site.id } },
              telephone: telephoneValue,
            },
          })
          crees++
        }
      } catch (err) {
        erreurs.push(`${finalMatricule} : ${codePrisma(err) === 'P2002' ? 'email déjà utilisé par un autre agent' : 'ligne invalide'}`)
      }
    }

    const parts = [`${crees} créé(s)`, `${misAJour} mis à jour`]
    if (ignores) parts.push(`${ignores} ligne(s) sans matricule ignorée(s)`)
    if (erreurs.length) parts.push(`${erreurs.length} en erreur`)

    return NextResponse.json({
      success: true,
      message: `Import terminé : ${parts.join(', ')}.`,
      crees,
      misAJour,
      ignores,
      erreurs: erreurs.slice(0, 50),
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: "Erreur lors de l'importation : vérifiez le format du fichier." }, { status: 500 })
  }
}
