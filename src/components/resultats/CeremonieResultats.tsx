'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { CarteLaureat, type TailleCarte } from '@/components/resultats/CarteLaureat'
import { Decompte } from '@/components/resultats/Decompte'
import { useSonDecompte } from '@/components/resultats/useSonDecompte'
import { LIBELLES_DISTINCTION, type Distinction } from '@/lib/distinctions'
import { versPalmares, type Laureat, type Palmares, type ReponseClassement } from '@/lib/palmares-ceremonie'
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

type Niveau = { titre: string; annonce: string; taille: TailleCarte; grille: string }

/** Chaque niveau tient sur une seule ligne dès que l'écran est assez large. */
const NIVEAUX: Record<Distinction, Niveau> = {
  CAPTAIN: { titre: 'Captain', annonce: 'le Captain', taille: 'grande', grille: 'mx-auto w-full max-w-3xl grid-cols-1' },
  CHIEF_OFFICER: {
    titre: 'Chief officers',
    annonce: 'les Chief officers',
    taille: 'moyenne',
    grille: 'grid-cols-2 gap-4 lg:grid-cols-[repeat(var(--colonnes),minmax(0,1fr))]',
  },
  SECOND_OFFICER: {
    titre: '2nd officers',
    annonce: 'les 2nd officers',
    taille: 'compacte',
    grille: 'grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-[repeat(var(--colonnes),minmax(0,1fr))]',
  },
}

const ERREUR_GENERIQUE = 'Les résultats n’ont pas pu être chargés. Vérifiez la connexion puis rechargez la page.'

/** Erreur dont le message peut être montré tel quel à l'écran. */
class ErreurResultats extends Error {}

type Chargement = { statut: 'chargement' } | { statut: 'erreur'; message: string } | { statut: 'pret'; palmares: Palmares }

async function chargerPalmares(campagneId: string, signal: AbortSignal): Promise<Palmares> {
  const reponse = await fetch(`/api/admin/classement?campagneId=${encodeURIComponent(campagneId)}`, {
    cache: 'no-store',
    signal,
  })
  if (reponse.status === 401) throw new ErreurResultats('Votre session a expiré. Reconnectez-vous pour afficher les résultats.')
  if (!reponse.ok) throw new ErreurResultats(ERREUR_GENERIQUE)

  const donnees = (await reponse.json()) as Partial<ReponseClassement>
  // Pour un identifiant inconnu, l'API retombe sur une autre campagne : on refuse ce repli.
  if (!donnees.laureats || donnees.campagne?.id !== campagneId) throw new ErreurResultats('Cette campagne est introuvable.')
  return versPalmares(donnees as ReponseClassement)
}

function usePalmares(campagneId: string): Chargement {
  const [chargement, setChargement] = useState<Chargement>({ statut: 'chargement' })

  useEffect(() => {
    const controleur = new AbortController()
    chargerPalmares(campagneId, controleur.signal)
      .then((palmares) => setChargement({ statut: 'pret', palmares }))
      .catch((erreur: unknown) => {
        if (controleur.signal.aborted) return
        setChargement({ statut: 'erreur', message: erreur instanceof ErreurResultats ? erreur.message : ERREUR_GENERIQUE })
      })
    return () => controleur.abort()
  }, [campagneId])

  return chargement
}

/**
 * Une fois lancée, la séquence avance seule : le décompte, puis chaque niveau,
 * au rythme donné par `delaiAvantSuite` (apparition du niveau, puis pause).
 */
function useRevelation(niveaux: Palmares['niveaux']) {
  const [etat, setEtat] = useState<EtatRevelation>(ETAT_INITIAL)
  const dernierRevele: Distinction | undefined = ORDRE_REVELATION[etat.niveauxReveles - 1]
  const delai = delaiAvantSuite(etat, dernierRevele ? niveaux[dernierRevele].length : 0)

  useEffect(() => {
    if (delai === null) return
    const minuterie = setTimeout(() => setEtat(avancer), delai)
    return () => clearTimeout(minuterie)
  }, [etat, delai])

  const lancer = useCallback(() => setEtat(lancerDecompte), [])
  const recommencer = useCallback(() => setEtat(ETAT_INITIAL), [])
  return { etat, dernierRevele, lancer, recommencer }
}

/** Espace ou Entrée lance la révélation, sauf quand le focus est sur une commande. */
function useToucheDeLancement(lancer: () => void) {
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key !== ' ' && evenement.key !== 'Enter') return
      if (evenement.target instanceof HTMLElement && evenement.target.closest('button, a, input, select, textarea')) return
      evenement.preventDefault()
      lancer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [lancer])
}

type CeremonieResultatsProps = { campagneId: string }

export default function CeremonieResultats({ campagneId }: CeremonieResultatsProps) {
  const chargement = usePalmares(campagneId)
  // Le palmarès annuel n'a pas de page de campagne : on revient au classement.
  const retour = campagneId.startsWith('ANNUEL_')
    ? `/admin/classement?campagneId=${encodeURIComponent(campagneId)}`
    : `/admin/campagnes/${encodeURIComponent(campagneId)}`

  return (
    <div className="flex min-h-dvh flex-col bg-navy-950 bg-[radial-gradient(ellipse_80%_45%_at_50%_0%,rgb(212_175_55/0.16),transparent_70%)] text-white">
      <EnTete libelle={chargement.statut === 'pret' ? chargement.palmares.libelle : ''} retour={retour} />
      {chargement.statut === 'chargement' && <Message>Chargement des résultats…</Message>}
      {chargement.statut === 'erreur' && <Message role="alert">{chargement.message}</Message>}
      {chargement.statut === 'pret' &&
        (chargement.palmares.aucunLaureat ? (
          <Message>Aucun agent n’est encore classé pour cette campagne : il n’y a pas de lauréat à révéler.</Message>
        ) : (
          <Scene palmares={chargement.palmares} />
        ))}
    </div>
  )
}

function EnTete({ libelle, retour }: { libelle: string; retour: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6 sm:px-10">
      <div className="flex min-w-0 items-center gap-4">
        <BrandMark size={44} />
        <div className="min-w-0">
          <p className="text-2xs font-semibold tracking-[0.25em] text-gold-400 uppercase">DSM TAMIS · Résultats</p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">{libelle || 'Résultats de la campagne'}</h1>
        </div>
      </div>
      <Link
        href={retour}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-navy-200 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
      </Link>
    </header>
  )
}

function Message({ children, role }: { children: React.ReactNode; role?: 'alert' }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <p role={role} className="max-w-xl text-center text-lg text-navy-100">
        {children}
      </p>
    </main>
  )
}

function Scene({ palmares }: { palmares: Palmares }) {
  const { etat, dernierRevele, lancer, recommencer } = useRevelation(palmares.niveaux)
  const [sonActif, setSonActif] = useState(true)
  const { preparer: preparerSon } = useSonDecompte(etat.decompte, sonActif)
  const lignes = useRef<Partial<Record<Distinction, HTMLElement | null>>>({})

  // Le son est préparé dans le geste (clic ou touche) qui lance le décompte : le navigateur l'exige.
  const lancerAvecSon = useCallback(() => {
    preparerSon()
    lancer()
  }, [preparerSon, lancer])
  useToucheDeLancement(lancerAvecSon)

  // Le niveau qui commence à apparaître est amené au centre de l'écran.
  useEffect(() => {
    if (!dernierRevele) return
    // Sans animation pour qui a demandé moins de mouvement à son système.
    const sansMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    lignes.current[dernierRevele]?.scrollIntoView({ behavior: sansMouvement ? 'auto' : 'smooth', block: 'center' })
  }, [dernierRevele])

  const phase: Phase = revelationTerminee(etat)
    ? 'terminee'
    : etat.decompte === null && etat.niveauxReveles === 0
      ? 'attente'
      : 'enCours'

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

      <BarreDeCommande
        phase={phase}
        peutRecommencer={etat.niveauxReveles > 0}
        sonActif={sonActif}
        onLancer={lancerAvecSon}
        onRecommencer={recommencer}
        onBasculerSon={() => setSonActif((actif) => !actif)}
      />

      {etat.decompte !== null && <Decompte valeur={etat.decompte} />}
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
  const { titre, taille, grille } = NIVEAUX[niveau]
  const colonnes = { '--colonnes': laureats.length } as CSSProperties
  return (
    <section ref={refLigne} aria-labelledby={`niveau-${niveau}`} className="space-y-3">
      <div className="flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/40" />
        <h2 id={`niveau-${niveau}`} className="font-display text-lg font-semibold text-gold-300 sm:text-xl">
          {titre}
          <span className="ml-3 font-sans text-xs font-normal text-navy-200">{LIBELLES_DISTINCTION[niveau].portee}</span>
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

/** Avant le lancement, pendant la séquence automatique, ou une fois le Captain révélé. */
type Phase = 'attente' | 'enCours' | 'terminee'

type BarreDeCommandeProps = {
  phase: Phase
  peutRecommencer: boolean
  sonActif: boolean
  onLancer: () => void
  onRecommencer: () => void
  onBasculerSon: () => void
}

const BOUTON_DISCRET =
  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-navy-200 transition-colors hover:bg-white/10 hover:text-white'

function BarreDeCommande(props: BarreDeCommandeProps) {
  const { phase, peutRecommencer, sonActif, onLancer, onRecommencer, onBasculerSon } = props
  const IconeSon = sonActif ? Volume2 : VolumeX
  return (
    <footer className="sticky bottom-0 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 bg-navy-950/85 px-6 py-4 backdrop-blur">
      {phase === 'attente' && (
        <>
          <button
            type="button"
            onClick={onLancer}
            className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-6 py-3 text-sm font-bold text-navy-950 shadow-raised transition-all hover:bg-gold-400 active:scale-95"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Lancer la révélation
          </button>
          <span className="hidden text-xs text-navy-300 sm:inline">ou touche Espace</span>
        </>
      )}
      {phase === 'enCours' && <p className="text-sm font-semibold text-navy-200">Révélation en cours…</p>}
      {phase === 'terminee' && (
        <p aria-live="polite" className="font-display text-lg font-semibold text-gold-300">
          Félicitations aux lauréats !
        </p>
      )}
      {peutRecommencer && (
        <button type="button" onClick={onRecommencer} className={BOUTON_DISCRET}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Recommencer
        </button>
      )}
      <button type="button" onClick={onBasculerSon} className={BOUTON_DISCRET}>
        <IconeSon className="h-4 w-4" aria-hidden /> {sonActif ? 'Son activé' : 'Son coupé'}
      </button>
    </footer>
  )
}
