import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { estRole } from '@/lib/roles'
import { chargerListes } from '@/lib/listes-serveur'
import { estListeLibre, LISTES_LIBRES, memeLibelle } from '@/lib/listes'

const nettoyer = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

/** Fiches agents qui portent une valeur (sans tenir compte de la casse). */
const fichesAvec = (champ: string, libelle: string) => ({ [champ]: { equals: libelle, mode: 'insensitive' as const } })

/**
 * Renomme une valeur (et toutes les fiches qui la portent) ou la marque par défaut.
 * Renommer vers une valeur existante fusionne les deux. Les rôles ne se renomment que par leur libellé.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }
  const libelle = nettoyer(body.libelle)
  if ('libelle' in body && (!libelle || libelle.length > 120)) {
    return NextResponse.json({ error: 'Saisissez une valeur (120 caractères au plus).' }, { status: 400 })
  }

  try {
    // Rôle jamais renommé jusqu'ici : identifiant provisoire « role-CODE »
    const codeRole = id.startsWith('role-') ? id.slice(5) : null
    const valeur = codeRole
      ? await prisma.valeurListe.findFirst({ where: { liste: 'ROLE', code: codeRole } })
      : await prisma.valeurListe.findUnique({ where: { id } })
    if (!valeur && !(codeRole && estRole(codeRole))) {
      return NextResponse.json({ error: 'Valeur introuvable' }, { status: 404 })
    }

    if (codeRole || valeur?.liste === 'ROLE') {
      if (!libelle) return NextResponse.json({ error: 'Seul le libellé d’un rôle se modifie.' }, { status: 400 })
      const code = codeRole ?? valeur!.code!
      const autres = await prisma.valeurListe.findMany({ where: { liste: 'ROLE', NOT: { code } } })
      if (autres.some((r) => memeLibelle(r.libelle, libelle))) {
        return NextResponse.json({ error: 'Un autre rôle porte déjà ce libellé.' }, { status: 409 })
      }
      if (valeur) await prisma.valeurListe.update({ where: { id: valeur.id }, data: { libelle } })
      else await prisma.valeurListe.create({ data: { liste: 'ROLE', code, libelle } })
      return NextResponse.json({ listes: await chargerListes(), message: 'Libellé du rôle modifié.' })
    }

    if (!valeur || !estListeLibre(valeur.liste)) {
      return NextResponse.json({ error: 'Valeur introuvable' }, { status: 404 })
    }
    const { champ } = LISTES_LIBRES[valeur.liste]
    let message = 'Liste mise à jour.'
    let fusionne = false

    if (libelle && libelle !== valeur.libelle) {
      const autres = await prisma.valeurListe.findMany({ where: { liste: valeur.liste, NOT: { id: valeur.id } } })
      const cible = autres.find((v) => memeLibelle(v.libelle, libelle))
      if (cible) {
        // Fusion : les fiches rejoignent la valeur existante, l'ancienne disparaît.
        const [maj] = await prisma.$transaction([
          prisma.utilisateur.updateMany({ where: fichesAvec(champ, valeur.libelle), data: { [champ]: cible.libelle } }),
          ...(valeur.parDefaut ? [prisma.valeurListe.update({ where: { id: cible.id }, data: { parDefaut: true } })] : []),
          prisma.valeurListe.delete({ where: { id: valeur.id } }),
        ])
        fusionne = true
        message = `« ${valeur.libelle} » fusionné dans « ${cible.libelle} » (${maj.count} fiche${maj.count > 1 ? 's' : ''}).`
      } else {
        const [, maj] = await prisma.$transaction([
          prisma.valeurListe.update({ where: { id: valeur.id }, data: { libelle } }),
          prisma.utilisateur.updateMany({ where: fichesAvec(champ, valeur.libelle), data: { [champ]: libelle } }),
        ])
        message = `Renommé en « ${libelle} » (${maj.count} fiche${maj.count > 1 ? 's' : ''} mise${maj.count > 1 ? 's' : ''} à jour).`
      }
    }

    if (typeof body.parDefaut === 'boolean' && !fusionne) {
      await prisma.$transaction([
        prisma.valeurListe.updateMany({ where: { liste: valeur.liste, parDefaut: true }, data: { parDefaut: false } }),
        ...(body.parDefaut ? [prisma.valeurListe.update({ where: { id: valeur.id }, data: { parDefaut: true } })] : []),
      ])
      message = body.parDefaut ? 'Valeur proposée par défaut aux nouveaux agents.' : 'Plus de valeur par défaut.'
    }

    return NextResponse.json({ listes: await chargerListes(), message })
  } catch (error) {
    console.error('API PATCH Error [listes/[id]]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/** Supprime une valeur qu'aucune fiche n'utilise. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  try {
    const valeur = id.startsWith('role-') ? null : await prisma.valeurListe.findUnique({ where: { id } })
    if (!valeur) return NextResponse.json({ error: 'Valeur introuvable' }, { status: 404 })
    if (!estListeLibre(valeur.liste)) {
      return NextResponse.json({ error: 'Les rôles déterminent les accès : ils se renomment mais ne se suppriment pas.' }, { status: 400 })
    }

    const n = await prisma.utilisateur.count({ where: fichesAvec(LISTES_LIBRES[valeur.liste].champ, valeur.libelle) })
    if (n > 0) {
      return NextResponse.json(
        { error: `« ${valeur.libelle} » est utilisé par ${n} agent${n > 1 ? 's' : ''}. Renommez-le vers une autre valeur pour les regrouper, ou modifiez ces fiches.` },
        { status: 409 }
      )
    }
    await prisma.valeurListe.delete({ where: { id } })
    return NextResponse.json({ listes: await chargerListes(), message: `« ${valeur.libelle} » supprimé.` })
  } catch (error) {
    console.error('API DELETE Error [listes/[id]]:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
