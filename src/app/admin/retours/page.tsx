'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'
import { SEUIL_ANONYMAT, type Tonalite } from '@/lib/commentaires'

type Campagne = { id: string; libelle: string; statut: string }
type AgentRetours = {
  id: string
  prenom: string
  nom: string
  matricule: string
  service: string | null
  totaux: Record<Tonalite, number>
  visibles: number
  masques: number
}

export default function RetoursPage() {
  const [campagneId, setCampagneId] = useState<string | null>(null)
  const [campagne, setCampagne] = useState<Campagne | null>(null)
  const [campagnes, setCampagnes] = useState<Campagne[]>([])
  const [agents, setAgents] = useState<AgentRetours[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    fetch(`/api/admin/retours${campagneId ? `?campagneId=${encodeURIComponent(campagneId)}` : ''}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Chargement impossible')
        if (annule) return
        setCampagne(data.campagne)
        setCampagnes(data.campagnes)
        setAgents(data.agents)
      })
      .catch((e) => !annule && setErreur(e instanceof Error ? e.message : 'Chargement impossible'))
      .finally(() => !annule && setChargement(false))
    return () => {
      annule = true
    }
  }, [campagneId])

  const changerCampagne = (id: string) => {
    setChargement(true)
    setErreur(null)
    setCampagneId(id)
  }

  const avecRetours = agents.filter((a) => a.visibles > 0)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <AdminHeader
        title="Retours des notés"
        subtitle="Commentaires reçus par chaque collaborateur, sans l’identité de leurs auteurs, pour préparer les entretiens."
        actions={
          campagnes.length > 0 && (
            <select
              value={campagne?.id ?? ''}
              onChange={(e) => changerCampagne(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              aria-label="Campagne"
            >
              {campagnes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>
          )
        }
      />

      <main className="mx-auto w-full max-w-7xl space-y-5 px-5 py-6 sm:px-8">
        <p className="flex items-start gap-2.5 rounded-2xl bg-navy-50 px-4 py-3 text-sm text-navy-800 ring-1 ring-navy-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy-600" aria-hidden />
          <span>
            Un commentaire n’est affiché que si au moins {SEUIL_ANONYMAT} personnes ont noté le même critère : son auteur reste
            caché parmi elles. Les autres sont comptés comme masqués. Seules les évaluations soumises sont prises en compte.
          </span>
        </p>

        {erreur && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

        <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
          {chargement ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement des retours…
            </p>
          ) : agents.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Aucune évaluation soumise pour cette campagne.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-2xs font-semibold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Collaborateur</th>
                  <th className="px-3 py-3 text-right">Reproches</th>
                  <th className="hidden px-3 py-3 text-right sm:table-cell">Neutres</th>
                  <th className="px-3 py-3 text-right">Points forts</th>
                  <th className="hidden px-3 py-3 text-right md:table-cell">Masqués</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((a) => (
                  <tr key={a.id} className={a.visibles === 0 ? 'text-slate-400' : 'hover:bg-slate-50/60'}>
                    <td className="px-5 py-3">
                      <span className="block font-medium text-navy-900">
                        {a.prenom} {a.nom}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {a.service || 'Service non renseigné'} · {a.matricule}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {a.totaux.reproche > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{a.totaux.reproche}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{a.totaux.neutre || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{a.totaux.point_fort || '—'}</td>
                    <td className="hidden px-3 py-3 text-right tabular-nums md:table-cell">
                      {a.masques > 0 ? (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <EyeOff className="h-3.5 w-3.5" aria-hidden />
                          {a.masques}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {a.visibles > 0 && campagne && (
                        <Link
                          href={`/admin/retours/${a.id}?campagneId=${encodeURIComponent(campagne.id)}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-navy-700 hover:bg-navy-50"
                        >
                          Fiche
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {!chargement && agents.length > 0 && (
          <p className="text-xs text-slate-500">
            {avecRetours.length} collaborateur{avecRetours.length > 1 ? 's' : ''} sur {agents.length} {avecRetours.length > 1 ? 'ont' : 'a'} des
            commentaires affichables · triés par nombre de reproches.
          </p>
        )}
      </main>
    </div>
  )
}
