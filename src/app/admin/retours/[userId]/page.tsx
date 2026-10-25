'use client'

import { use, useEffect, useState } from 'react'
import { EyeOff, Loader2, Printer, ShieldCheck } from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'
import { SEUIL_ANONYMAT, type FicheRetours, type Tonalite } from '@/lib/commentaires'

type Reponse = {
  campagne: { id: string; libelle: string }
  agent: { prenom: string; nom: string; matricule: string; service: string | null; emploi: string | null }
  fiche: FicheRetours
}

const TONALITES: Record<Tonalite, { libelle: string; pluriel: string; pastille: string; bord: string }> = {
  reproche: { libelle: 'Reproche', pluriel: 'Reproches', pastille: 'bg-amber-100 text-amber-800', bord: 'border-l-amber-400' },
  neutre: { libelle: 'Remarque', pluriel: 'Remarques', pastille: 'bg-slate-100 text-slate-700', bord: 'border-l-slate-300' },
  point_fort: { libelle: 'Point fort', pluriel: 'Points forts', pastille: 'bg-emerald-50 text-emerald-800', bord: 'border-l-emerald-400' },
}

export default function FicheRetoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ campagneId?: string }>
}) {
  const { userId } = use(params)
  const { campagneId } = use(searchParams)
  const [data, setData] = useState<Reponse | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    const requete = `/api/admin/retours/${encodeURIComponent(userId)}${campagneId ? `?campagneId=${encodeURIComponent(campagneId)}` : ''}`
    fetch(requete, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Chargement impossible')
        if (!annule) setData(json)
      })
      .catch((e) => !annule && setErreur(e instanceof Error ? e.message : 'Chargement impossible'))
    return () => {
      annule = true
    }
  }, [userId, campagneId])

  const titre = data ? `${data.agent.prenom} ${data.agent.nom}` : 'Fiche de retours'

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <AdminHeader
        title={titre}
        subtitle={
          data && (
            <>
              {data.agent.service || 'Service non renseigné'}
              {data.agent.emploi && <> · {data.agent.emploi}</>} · {data.agent.matricule} · {data.campagne.libelle}
            </>
          )
        }
        back={{ href: '/admin/retours', label: 'Retours des notés' }}
        actions={
          data && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 print:hidden"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Imprimer la fiche
            </button>
          )
        }
      />

      <main className="mx-auto w-full max-w-4xl space-y-5 px-5 py-6 sm:px-8">
        {erreur && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}
        {!data && !erreur && (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement de la fiche…
          </p>
        )}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {(['reproche', 'neutre', 'point_fort'] as const).map((t) => (
                <div key={t} className="rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-200/70">
                  <p className="text-2xs font-semibold tracking-wider text-slate-500 uppercase">{TONALITES[t].pluriel}</p>
                  <p className="mt-1 font-display text-3xl text-navy-900 tabular-nums">{data.fiche.totaux[t]}</p>
                </div>
              ))}
            </div>

            <p className="flex items-start gap-2.5 rounded-2xl bg-navy-50 px-4 py-3 text-sm text-navy-800 ring-1 ring-navy-100">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy-600" aria-hidden />
              <span>
                Document confidentiel. Les auteurs ne sont jamais indiqués ; la provenance n’est précisée que lorsqu’au moins{' '}
                {SEUIL_ANONYMAT} personnes de cette provenance ont noté le critère.
                {data.fiche.masques > 0 && (
                  <>
                    {' '}
                    <strong className="font-semibold">
                      {data.fiche.masques} commentaire{data.fiche.masques > 1 ? 's' : ''} masqué{data.fiche.masques > 1 ? 's' : ''}
                    </strong>{' '}
                    : trop peu de notants pour protéger leur auteur.
                  </>
                )}
              </span>
            </p>

            {data.fiche.criteres.length === 0 ? (
              <p className="flex items-center justify-center gap-2 rounded-2xl bg-white py-12 text-sm text-slate-500 ring-1 ring-slate-200/70">
                <EyeOff className="h-4 w-4" aria-hidden />
                Aucun commentaire affichable pour ce collaborateur.
              </p>
            ) : (
              data.fiche.criteres.map((c) => (
                <section key={c.critereId} className="break-inside-avoid rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 sm:p-6">
                  <h2 className="font-display text-xl text-navy-900">{c.critereLibelle}</h2>
                  <ul className="mt-4 space-y-3">
                    {c.commentaires.map((m, i) => {
                      const t = TONALITES[m.tonalite]
                      return (
                        <li key={i} className={`rounded-xl border-l-4 bg-slate-50/70 px-4 py-3 ${t.bord}`}>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${t.pastille}`}>{t.libelle}</span>
                            <span className="text-slate-500 tabular-nums">
                              Note {m.valeur}/{m.noteMaximale}
                            </span>
                            <span className="text-slate-400">· {m.provenance}</span>
                          </div>
                          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-slate-800">{m.texte}</p>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </main>
    </div>
  )
}
