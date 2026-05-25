import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST() {
  try {
    const existing = await prisma.utilisateur.findUnique({
      where: { matricule: '7453' },
    })

    if (existing) {
      await prisma.utilisateur.update({
        where: { id: existing.id },
        data: { email: 'jeanfelicks11@gmail.com', role: 'ADMIN' },
      })
      return NextResponse.json({ message: 'Admin déjà existant, email mis à jour' })
    }

    const site = await prisma.site.upsert({
      where: { nom: 'Siège Social' },
      update: {},
      create: { nom: 'Siège Social', ville: 'Abidjan' },
    })

    await prisma.utilisateur.create({
      data: {
        matricule: '7453',
        nom: 'ADMIN',
        prenom: 'System',
        email: 'jeanfelicks11@gmail.com',
        motDePasse: '',
        role: 'ADMIN',
        siteId: site.id,
      },
    })

    return NextResponse.json({ message: 'Admin créé avec succès' })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}