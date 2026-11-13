import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'

type CadreResultatsProps = {
  campagneId: string
  /** Vide tant que le libellé de la campagne n'est pas connu. */
  libelle: string
  /** Lien de retour vers l'administration : réservé aux administrateurs, la page étant publique. */
  avecRetour: boolean
  children: ReactNode
}

/** Décor commun aux écrans des résultats (attente, puis révélation) : fond, en-tête et lien de retour. */
export function CadreResultats({ campagneId, libelle, avecRetour, children }: CadreResultatsProps) {
  // Le palmarès annuel n'a pas de page de campagne : on revient au classement.
  const retour = campagneId.startsWith('ANNUEL_')
    ? `/admin/classement?campagneId=${encodeURIComponent(campagneId)}`
    : `/admin/campagnes/${encodeURIComponent(campagneId)}`

  return (
    <div className="flex min-h-dvh flex-col bg-navy-950 bg-[radial-gradient(ellipse_80%_45%_at_50%_0%,rgb(212_175_55/0.16),transparent_70%)] text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6 sm:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <BrandMark size={44} />
          <div className="min-w-0">
            <p className="text-2xs font-semibold tracking-[0.25em] text-gold-400 uppercase">DSM TAMIS · Résultats</p>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">{libelle || 'Résultats de la campagne'}</h1>
          </div>
        </div>
        {avecRetour && (
          <Link
            href={retour}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-navy-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
          </Link>
        )}
      </header>
      {children}
    </div>
  )
}

/** Message seul au centre de l'écran : résultats non publiés, campagne introuvable, aucun lauréat… */
export function MessageResultats({ children, role }: { children: ReactNode; role?: 'alert' }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <p role={role} className="max-w-xl text-center text-lg text-navy-100">
        {children}
      </p>
    </main>
  )
}
