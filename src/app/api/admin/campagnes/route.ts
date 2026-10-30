import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { CRITERES_OFFICIELS_DSM } from '@/lib/default-criteres'
import { normaliserTypes } from '@/lib/criteres'
import { validerPoids } from '@/lib/campagne'
import { messageReconduction, reconduireAffectations } from '@/lib/reconduction'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const campagnes = await prisma.campagne.findMany({
      include: {
        _count: { select: { criteres: true, affectations: true } }
      },
      orderBy: { dateDebut: 'desc' }
    })
    return NextResponse.json(campagnes)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

const entier = (v: unknown, defaut: number) => (v === undefined || v === null || v === '' ? defaut : Number(v))

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const libelle = typeof body.libelle === 'string' ? body.libelle.trim() : ''
    const dateDebut = new Date(body.dateDebut)
    const dateFin = new Date(body.dateFin)

    if (!libelle || Number.isNaN(dateDebut.getTime()) || Number.isNaN(dateFin.getTime())) {
      return NextResponse.json({ error: 'Libellé, date de début et date de fin sont obligatoires.' }, { status: 400 })
    }
    if (dateFin < dateDebut) {
      return NextResponse.json({ error: 'La date de fin doit suivre la date de début.' }, { status: 400 })
    }

    const poids = {
      poidsCollegues: entier(body.poidsCollegues, 45),
      poidsManager: entier(body.poidsManager, 55),
      poidsClient: entier(body.poidsClient, 25),
    }
    const erreurPoids = validerPoids(poids)
    if (erreurPoids) return NextResponse.json({ error: erreurPoids }, { status: 400 })

    // Une seule campagne ouverte à la fois : la nouvelle est créée clôturée si une autre est en cours.
    const dejaOuverte = await prisma.campagne.findFirst({ where: { statut: 'OUVERTE' }, select: { libelle: true } })

    const campagne = await prisma.campagne.create({
      data: {
        libelle,
        dateDebut,
        dateFin,
        ...poids,
        statut: dejaOuverte ? 'CLOTUREE' : 'OUVERTE',
        criteres: {
          create: CRITERES_OFFICIELS_DSM.map((c) => ({
            libelle: c.libelle,
            description: c.description,
            noteMaximale: c.noteMaximale,
            ...normaliserTypes([c.typeEvaluateur]),
          })),
        },
      },
      include: { criteres: true },
    })

    // Reprise facultative des affectations d'une campagne précédente
    const reconduireDepuis = typeof body.reconduireDepuis === 'string' ? body.reconduireDepuis : ''
    let reconduction: string | null = null
    if (reconduireDepuis) {
      try {
        reconduction = messageReconduction(await reconduireAffectations(campagne.id, reconduireDepuis))
      } catch (error) {
        // La campagne est créée : l'administrateur pourra reconduire depuis l'onglet Répartition.
        console.error('Reconduction à la création:', error)
        reconduction = "Les affectations n'ont pas pu être reconduites : relancez la reconduction depuis l'onglet Répartition."
      }
    }

    return NextResponse.json({
      ...campagne,
      reconduction,
      avertissement: dejaOuverte
        ? `La campagne « ${dejaOuverte.libelle} » est encore ouverte : la nouvelle campagne a été créée fermée. Ouvrez-la après avoir clôturé l'autre.`
        : null,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
