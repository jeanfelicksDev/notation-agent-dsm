import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma, Role } from '@prisma/client'
import { codePrisma } from '@/lib/erreurs'
import { normalizeMatricule, requireAdmin } from '@/lib/auth'
import { normaliserSexe } from '@/lib/agents'
import { completerListes, directionParDefaut } from '@/lib/listes-serveur'
import * as XLSX from 'xlsx'

/**
 * POST /api/admin/utilisateurs/import
 *
 * Format de référence (liste RH) :
 *   Matricule · Nom · Prénom · Sexe · Nationalité · Emploi · Service · Département · Direction
 * Les colonnes « Statut », « Téléphone » et « Email » restent acceptées si elles sont présentes.
 *
 * Règles :
 * - un agent est reconnu par son matricule ; il est créé s'il n'existe pas, mis à jour sinon ;
 * - seules les colonnes présentes dans le fichier sont modifiées, et une cellule vide ne
 *   remplace jamais une valeur existante ;
 * - sans colonne Statut, le rôle d'un agent existant est conservé et un nouvel agent est créé « Agent » ;
 * - un administrateur n'est jamais rétrogradé, et aucun administrateur n'est créé par import ;
 * - les agents absents du fichier ne sont pas modifiés.
 */

type Champ =
  | 'matricule' | 'nom' | 'prenom' | 'sexe' | 'nationalite' | 'emploi'
  | 'service' | 'departement' | 'direction' | 'statut' | 'telephone' | 'email'

/** En-tête normalisé : minuscules, sans accents, sans ponctuation ni sauts de ligne. */
const cle = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Reconnaît une colonne par le début de son en-tête (ex. « Département (Dsm/Manut) » → departement). */
function champDe(entete: string): Champ | null {
  const k = cle(entete)
  if (k.startsWith('matricule')) return 'matricule'
  if (k === 'nom' || k === 'noms' || k.startsWith('nom ')) return 'nom'
  if (k.startsWith('prenom')) return 'prenom'
  if (k.startsWith('sexe') || k === 'genre') return 'sexe'
  if (k.startsWith('nationalite')) return 'nationalite'
  if (k.startsWith('emploi') || k.startsWith('fonction') || k.startsWith('poste')) return 'emploi'
  if (k.startsWith('service')) return 'service'
  if (k.startsWith('departement')) return 'departement'
  if (k.startsWith('direction')) return 'direction'
  if (k.startsWith('statut') || k.startsWith('status') || k.startsWith('role')) return 'statut'
  if (k.startsWith('telephone') || k === 'tel') return 'telephone'
  if (k.startsWith('email') || k.startsWith('e mail')) return 'email'
  return null
}

function roleDepuisStatut(statut: string): Role | null {
  const s = cle(statut)
  if (!s) return null
  if (s.includes('manager')) return 'MANAGER'
  if (s.includes('externe') || s.includes('client')) return 'EXTERNE'
  if (s.includes('admin')) return 'ADMIN'
  if (s.includes('cadre')) return 'CADRE'
  return 'UTILISATEUR'
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: false })
    if (lignes.length < 2) {
      return NextResponse.json({ error: 'Fichier vide ou sans ligne de données.' }, { status: 400 })
    }

    // Repérage des colonnes à partir de la première ligne
    const colonnes = new Map<Champ, number>()
    ;(lignes[0] as unknown[]).forEach((entete, i) => {
      const champ = champDe(String(entete ?? ''))
      if (champ && !colonnes.has(champ)) colonnes.set(champ, i)
    })
    if (!colonnes.has('matricule') || !colonnes.has('nom')) {
      return NextResponse.json(
        { error: 'Colonnes « Matricule » et « Nom » introuvables. Utilisez le modèle Excel fourni.' },
        { status: 400 }
      )
    }
    const present = (c: Champ) => colonnes.has(c)

    let crees = 0
    let misAJour = 0
    let ignores = 0
    const erreurs: string[] = []
    const vus = new Set<string>()
    const direction = await directionParDefaut()
    const valeursLues: Array<Record<string, unknown>> = []

    for (let n = 1; n < lignes.length; n++) {
      const ligne = lignes[n] as unknown[]
      const v = (c: Champ) => {
        const i = colonnes.get(c)
        return i === undefined ? '' : String(ligne[i] ?? '').trim()
      }

      const brut = v('matricule')
      if (!brut) {
        ignores++
        continue
      }
      const matricule = normalizeMatricule(brut)
      if (vus.has(matricule)) {
        erreurs.push(`Ligne ${n + 1} (${matricule}) : matricule en double dans le fichier, ligne ignorée`)
        continue
      }
      vus.add(matricule)

      const sexeBrut = v('sexe')
      const sexe = normaliserSexe(sexeBrut)
      if (sexeBrut && !sexe) {
        erreurs.push(`Ligne ${n + 1} (${matricule}) : sexe « ${sexeBrut} » non reconnu (attendu M ou F), laissé inchangé`)
      }

      // Champs descriptifs : présents dans le fichier et non vides
      const champs: Prisma.UtilisateurUpdateInput = {}
      if (v('nom')) champs.nom = v('nom')
      if (v('prenom')) champs.prenom = v('prenom')
      if (sexe) champs.sexe = sexe
      for (const c of ['nationalite', 'emploi', 'service', 'departement', 'direction'] as const) {
        if (v(c)) champs[c] = v(c)
      }
      if (v('email')) champs.email = v('email').toLowerCase()
      valeursLues.push({ ...champs, direction: v('direction') || direction })

      const roleFichier = present('statut') ? roleDepuisStatut(v('statut')) : null

      try {
        const existant = await prisma.utilisateur.findFirst({
          where: { matricule: { equals: matricule, mode: 'insensitive' } },
          select: { id: true, role: true },
        })

        if (existant) {
          const role = roleFichier && existant.role !== 'ADMIN' && roleFichier !== 'ADMIN' ? roleFichier : undefined
          const telephone = v('telephone') || (role === 'EXTERNE' ? brut : '')
          await prisma.utilisateur.update({
            where: { id: existant.id },
            data: { ...champs, ...(role ? { role } : {}), ...(telephone ? { telephone } : {}) },
          })
          misAJour++
        } else {
          const role: Role = roleFichier && roleFichier !== 'ADMIN' ? roleFichier : 'UTILISATEUR'
          const telephone = v('telephone') || (role === 'EXTERNE' ? brut : '')
          await prisma.utilisateur.create({
            data: {
              ...(champs as Prisma.UtilisateurCreateInput),
              matricule,
              nom: v('nom') || 'Sans nom',
              prenom: v('prenom'),
              email: (champs.email as string | undefined) ?? `${matricule.toLowerCase().replace(/[^a-z0-9]/g, '') || `agent-${n}`}@dsm.local`,
              motDePasse: '', // PIN à définir par l'agent à sa première connexion
              role,
              telephone: telephone || null,
              direction: v('direction') || direction,
            },
          })
          crees++
        }
      } catch (err) {
        erreurs.push(
          `Ligne ${n + 1} (${matricule}) : ${codePrisma(err) === 'P2002' ? 'email déjà utilisé par un autre agent' : 'ligne invalide'}`
        )
      }
    }

    // Les valeurs nouvelles du fichier rejoignent les listes déroulantes.
    await completerListes(valeursLues)

    const parts = [`${crees} créé(s)`, `${misAJour} mis à jour`]
    if (ignores) parts.push(`${ignores} ligne(s) sans matricule ignorée(s)`)
    if (erreurs.length) parts.push(`${erreurs.length} anomalie(s)`)

    return NextResponse.json({
      success: true,
      message: `Import terminé : ${parts.join(', ')}.`,
      crees,
      misAJour,
      ignores,
      colonnesReconnues: [...colonnes.keys()],
      erreurs: erreurs.slice(0, 100),
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: "Erreur lors de l'importation : vérifiez le format du fichier." }, { status: 500 })
  }
}
