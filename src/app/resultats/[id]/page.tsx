import type { Metadata } from 'next'
import { CadreResultats, MessageResultats } from '@/components/resultats/CadreResultats'
import CeremonieResultats from '@/components/resultats/CeremonieResultats'
import ResultatsEnAttente from '@/components/resultats/ResultatsEnAttente'
import { requireAdmin } from '@/lib/auth'
import { campagnesDuPalmaresAnnuel } from '@/lib/campagne'
import { getFullClassementData } from '@/lib/classement'
import { versPalmares, type Palmares } from '@/lib/palmares-ceremonie'
import prisma from '@/lib/prisma'
import {
  anneeDuPalmaresAnnuel,
  datePublicationAnnuelle,
  delaiAvantPublication,
  ecranDesResultats,
} from '@/lib/publication-resultats'

export const metadata: Metadata = { title: 'Résultats de la campagne' }

/** Ce qui est demandé (campagne ou palmarès annuel) et sa date de publication ; null si rien n'est fixé. */
type Publication = { libelle: string; dateResultats: Date | null }

/** Publication de la page demandée ; null si la campagne n'existe pas. */
async function publicationPrevue(id: string, estAdmin: boolean): Promise<Publication | null> {
  const annee = anneeDuPalmaresAnnuel(id)
  if (annee !== null) {
    // Le palmarès annuel reprend les lauréats de ses campagnes : sa publication dépend des leurs.
    const campagnes = await prisma.campagne.findMany({
      where: campagnesDuPalmaresAnnuel(annee),
      select: { dateResultats: true },
    })
    const dates = campagnes.map((campagne) => campagne.dateResultats)
    return { libelle: `Palmarès annuel ${annee}`, dateResultats: datePublicationAnnuelle(dates, estAdmin) }
  }

  return prisma.campagne.findUnique({ where: { id }, select: { libelle: true, dateResultats: true } })
}

/** Le palmarès seul : le reste du classement (rangs, notes détaillées, non-classés) ne quitte pas le serveur. */
async function chargerPalmares(id: string): Promise<Palmares | null> {
  try {
    return versPalmares(await getFullClassementData(id))
  } catch (erreur) {
    console.error(`Résultats ${id} : le palmarès n'a pas pu être calculé.`, erreur)
    return null
  }
}

/**
 * Page de révélation des résultats d'une campagne, pensée pour être projetée. Elle est ouverte à tous,
 * sans connexion, à partir du jour et de l'heure fixés pour la campagne ; avant, elle n'affiche qu'un
 * écran d'attente. Tant qu'aucune date n'est fixée, seul l'administrateur voit les résultats.
 */
export default async function ResultatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const estAdmin = (await requireAdmin()) !== null
  const publication = await publicationPrevue(id, estAdmin)

  if (!publication) {
    return (
      <CadreResultats campagneId={id} libelle="" avecRetour={estAdmin}>
        <MessageResultats role="alert">Cette campagne est introuvable.</MessageResultats>
      </CadreResultats>
    )
  }

  const { libelle, dateResultats } = publication
  const maintenant = new Date()
  const ecran = ecranDesResultats(dateResultats, maintenant, estAdmin)

  if (ecran === 'NON_PUBLIES') {
    return (
      <CadreResultats campagneId={id} libelle={libelle} avecRetour={estAdmin}>
        <MessageResultats>Les résultats ne sont pas encore publiés. Revenez un peu plus tard.</MessageResultats>
      </CadreResultats>
    )
  }

  if (ecran === 'ATTENTE' && dateResultats) {
    return (
      <CadreResultats campagneId={id} libelle={libelle} avecRetour={estAdmin}>
        <ResultatsEnAttente
          dateResultats={dateResultats.toISOString()}
          delaiMs={delaiAvantPublication(dateResultats, maintenant)}
        />
      </CadreResultats>
    )
  }

  const palmares = await chargerPalmares(id)
  // La clé repart d'une scène neuve (palmarès et révélation) quand on passe d'une campagne à une autre.
  return <CeremonieResultats key={id} campagneId={id} libelle={libelle} palmares={palmares} avecRetour={estAdmin} />
}
