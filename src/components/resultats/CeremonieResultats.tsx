'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CadreResultats, MessageResultats } from '@/components/resultats/CadreResultats'
import { CarteLaureat, type TailleCarte } from '@/components/resultats/CarteLaureat'
import { Decompte } from '@/components/resultats/Decompte'
import { celebrer } from '@/components/resultats/confettis'
import { useSonCeremonie } from '@/components/resultats/useSonCeremonie'
import { LIBELLES_DISTINCTION, type Distinction } from '@/lib/distinctions'
import type { Laureat, Palmares } from '@/lib/palmares-ceremonie'
import {
  avancer,
  delaiAvantSuite,
  estRevele,
  ETAT_INITIAL,
  lancerDecompte,
  ORDRE_REVELATION,
  revelationTerminee,
  type EtatRevelation,
} from '@/lib/revelation'

/** À l'écran, le Captain est en haut ; la révélation, elle, remonte des 2nd officers au Captain. */
const ORDRE_AFFICHAGE: readonly Distinction[] = ['CAPTAIN', 'CHIEF_OFFICER', 'SECOND_OFFICER']

type Niveau = { titre: string; sousTitre: string; annonce: string; taille: TailleCarte; grille: string }

/** Chaque niveau tient sur une seule ligne dès que l'écran est assez large. */
const NIVEAUX: Record<Distinction, Niveau> = {
  CAPTAIN: {
    titre: 'Captain',
    sousTitre: LIBELLES_DISTINCTION.CAPTAIN.portee,
    annonce: 'le Captain',
    taille: 'grande',
    grille: 'mx-auto w-full max-w-3xl grid-cols-1',
  },
  CHIEF_OFFICER: {
    titre: 'Chief officers',
    sousTitre: 'Les meilleurs agents de chaque Département',
    annonce: 'les Chief officers',
    taille: 'moyenne',
    grille: 'grid-cols-2 gap-4 lg:grid-cols-[repeat(var(--colonnes),minmax(0,1fr))]',
  },
  SECOND_OFFICER: {
    titre: '2nd officers',
    sousTitre: 'Les meilleurs agents de chaque Service',
    annonce: 'les 2nd officers',
    taille: 'compacte',
    grille: 'grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-[repeat(var(--colonnes),minmax(0,1fr))]',
  },
}

const ERREUR_GENERIQUE = 'Les résultats n’ont pas pu être chargés. Rechargez la page dans un instant.'

/**
 * Le décompte part dès l'ouverture de la page, puis la séquence avance seule : chaque niveau,
 * au rythme donné par `delaiAvantSuite` (apparition du niveau, puis pause).
 * Pour la rejouer, on recharge la page.
 */
function useRevelation(niveaux: Palmares['niveaux']) {
  const [etat, setEtat] = useState<EtatRevelation>(() => lancerDecompte(ETAT_INITIAL))
  const dernierRevele: Distinction | undefined = ORDRE_REVELATION[etat.niveauxReveles - 1]
  const delai = delaiAvantSuite(etat, dernierRevele ? niveaux[dernierRevele].length : 0)

  useEffect(() => {
    if (delai === null) return
    const minuterie = setTimeout(() => setEtat(avancer), delai)
    return () => clearTimeout(minuterie)
  }, [etat, delai])

  return { etat, dernierRevele }
}

type CeremonieResultatsProps = {
  campagneId: string
  libelle: string
  /** Palmarès préparé par le serveur, qui a déjà vérifié que le visiteur peut le voir ; null s'il n'a pas pu être calculé. */
  palmares: Palmares | null
  /** Lien de retour vers l'administration : réservé aux administrateurs. */
  avecRetour: boolean
}

export default function CeremonieResultats({ campagneId, libelle, palmares, avecRetour }: CeremonieResultatsProps) {
  return (
    <CadreResultats campagneId={campagneId} libelle={libelle} avecRetour={avecRetour}>
      {palmares === null && <MessageResultats role="alert">{ERREUR_GENERIQUE}</MessageResultats>}
      {palmares?.aucunLaureat && (
        <MessageResultats>
          Aucun agent n’est encore classé pour cette campagne : il n’y a pas de lauréat à révéler.
        </MessageResultats>
      )}
      {palmares && !palmares.aucunLaureat && <Scene palmares={palmares} />}
    </CadreResultats>
  )
}

function Scene({ palmares }: { palmares: Palmares }) {
  const { etat, dernierRevele } = useRevelation(palmares.niveaux)
  const captainRevele = estRevele(etat, 'CAPTAIN')
  // Le navigateur peut attendre un geste (clic ou touche) avant d'autoriser le son : on le signale.
  const { estBloque: sonEnAttente } = useSonCeremonie({ decompte: etat.decompte, captainRevele })

  // Le Captain apparaît dans une explosion de confettis, effacée quand on quitte la page.
  useEffect(() => (captainRevele ? celebrer() : undefined), [captainRevele])
  const lignes = useRef<Partial<Record<Distinction, HTMLElement | null>>>({})

  // Le niveau qui commence à apparaître est amené au centre de l'écran.
  useEffect(() => {
    if (!dernierRevele) return
    // Sans animation pour qui a demandé moins de mouvement à son système.
    const sansMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    lignes.current[dernierRevele]?.scrollIntoView({ behavior: sansMouvement ? 'auto' : 'smooth', block: 'center' })
  }, [dernierRevele])

  return (
    <>
      <main className="flex flex-1 flex-col justify-center gap-8 px-4 py-8 sm:px-10">
        {palmares.provisoire && (
          <p className="mx-auto rounded-full bg-white/10 px-4 py-1 text-xs font-semibold text-gold-200 ring-1 ring-gold-500/30">
            Résultats provisoires : la campagne n’est pas encore clôturée
          </p>
        )}
        {ORDRE_AFFICHAGE.filter((niveau) => palmares.niveaux[niveau].length > 0).map((niveau) => (
          <LigneNiveau
            key={niveau}
            niveau={niveau}
            laureats={palmares.niveaux[niveau]}
            estRevele={estRevele(etat, niveau)}
            refLigne={(element) => {
              lignes.current[niveau] = element
            }}
          />
        ))}
      </main>

      {/* Annonce de chaque révélation aux lecteurs d'écran. */}
      <p aria-live="polite" className="sr-only">
        {dernierRevele ? `Révélation : ${NIVEAUX[dernierRevele].annonce}.` : ''}
      </p>

      <BandeauDEtat estTerminee={revelationTerminee(etat)} />

      {etat.decompte !== null && <Decompte valeur={etat.decompte} sonEnAttente={sonEnAttente} />}
    </>
  )
}

type LigneNiveauProps = {
  niveau: Distinction
  laureats: Laureat[]
  estRevele: boolean
  refLigne: (element: HTMLElement | null) => void
}

function LigneNiveau({ niveau, laureats, estRevele: revele, refLigne }: LigneNiveauProps) {
  const { titre, sousTitre, taille, grille } = NIVEAUX[niveau]
  const colonnes = { '--colonnes': laureats.length } as CSSProperties
  return (
    <section ref={refLigne} aria-labelledby={`niveau-${niveau}`} className="space-y-3">
      <div className="flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/40" />
        <h2 id={`niveau-${niveau}`} className="font-display text-lg font-semibold text-gold-300 sm:text-xl">
          {titre}
          <span className="ml-3 font-sans text-xs font-normal text-navy-200">{sousTitre}</span>
        </h2>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/40" />
      </div>
      <div className={`grid ${grille}`} style={colonnes}>
        {laureats.map((laureat, rang) => (
          <CarteLaureat key={laureat.cle} laureat={laureat} estRevele={revele} taille={taille} rang={rang} />
        ))}
      </div>
    </section>
  )
}

/** Bandeau du bas : l'avancement de la séquence, sans commande (elle se déroule seule). */
function BandeauDEtat({ estTerminee }: { estTerminee: boolean }) {
  return (
    <footer className="sticky bottom-0 flex items-center justify-center border-t border-white/10 bg-navy-950/85 px-6 py-4 backdrop-blur">
      {estTerminee ? (
        <p aria-live="polite" className="font-display text-lg font-semibold text-gold-300">
          Félicitations aux lauréats !
        </p>
      ) : (
        <p className="text-sm font-semibold text-navy-200">Révélation en cours…</p>
      )}
    </footer>
  )
}
