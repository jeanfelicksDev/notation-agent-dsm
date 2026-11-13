'use client'

import AdminHeader from '@/components/AdminHeader'
import { GestionListe, useListes } from '@/components/listes'
import { TITRES_LISTES, type NomListe } from '@/lib/listes'

const ORDRE: { liste: NomListe; aide: string }[] = [
  { liste: 'SERVICE', aide: 'Le service sert aussi à répartir collègues et clients internes.' },
  { liste: 'DEPARTEMENT', aide: 'Regroupe les services pour le classement par département.' },
  { liste: 'DIRECTION', aide: 'L’étoile désigne la direction proposée aux nouveaux agents.' },
  { liste: 'NATIONALITE', aide: 'Nationalités proposées dans les fiches agents.' },
  { liste: 'ROLE', aide: 'Libellés affichés pour chaque rôle.' },
]

export default function ListesPage() {
  const { listes, setListes, pret } = useListes()

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <AdminHeader
        title="Listes déroulantes"
        subtitle="Valeurs proposées dans les fiches agents. Renommer une valeur met à jour toutes les fiches qui la portent."
        back={{ href: '/admin/utilisateurs', label: 'Agents' }}
      />
      <main className="mx-auto grid w-full max-w-[104rem] gap-5 px-5 py-6 sm:px-8 lg:grid-cols-2">
        {ORDRE.map(({ liste, aide }) => (
          <section key={liste} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg text-navy-900">{TITRES_LISTES[liste]}</h2>
              <span className="text-xs tabular-nums text-slate-400">
                {pret ? `${listes[liste].length} valeur${listes[liste].length > 1 ? 's' : ''}` : '…'}
              </span>
            </div>
            <p className="mb-4 text-sm text-slate-500">{aide}</p>
            <GestionListe liste={liste} listes={listes} onListes={setListes} />
          </section>
        ))}
      </main>
    </div>
  )
}
