'use client'

import { useMemo, useState } from 'react'
import { Activity, CheckCircle2, ChevronDown, Clock, Search, X } from 'lucide-react'
import { estCadre } from '@/lib/roles'
import {
  filtrerSuivi,
  suiviParNote,
  trierSuivi,
  type AffectationSuivi,
  type EtatNotation,
  type FiltreEtat,
  type TriSuivi,
} from '@/lib/suivi-par-note'

/** Onglet Suivi, vue « Par noté » : pour chaque collaborateur noté, ses notants et l'état de leur notation. */

type Personne = { id: string; nom: string; prenom: string; matricule: string; role: string; service?: string | null }

const ETATS: Record<EtatNotation, { libelle: string; Icone: typeof Clock; badge: string; pastille: string }> = {
  EN_ATTENTE: { libelle: 'Non commencé', Icone: Clock, badge: 'bg-slate-100 text-slate-600', pastille: 'bg-slate-600 text-white' },
  BROUILLON: { libelle: 'En cours', Icone: Activity, badge: 'bg-amber-100 text-amber-700', pastille: 'bg-amber-600 text-white' },
  TERMINEE: { libelle: 'Terminé', Icone: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700', pastille: 'bg-emerald-600 text-white' },
  INVALIDEE: { libelle: 'Invalidé', Icone: X, badge: 'bg-rose-100 text-rose-700', pastille: 'bg-rose-600 text-white' },
}
const ORDRE_FILTRES: FiltreEtat[] = ['TOUS', 'EN_ATTENTE', 'BROUILLON', 'TERMINEE', 'INVALIDEE']

function libelleRole(role: string) {
  if (role === 'MANAGER') return 'Manager'
  if (role === 'EXTERNE') return 'Client ext.'
  if (estCadre(role)) return 'Cadre · facultatif'
  return 'Pair'
}

function BadgeEtat({ etat }: { etat: EtatNotation }) {
  const { libelle, Icone, badge } = ETATS[etat]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge}`}>
      <Icone className="h-3.5 w-3.5" aria-hidden /> {libelle}
    </span>
  )
}

export default function SuiviParNote({ affectations, users }: { affectations: AffectationSuivi[]; users: Personne[] }) {
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<FiltreEtat>('TOUS')
  const [tri, setTri] = useState<TriSuivi>('RESTANTS')
  const [ouverts, setOuverts] = useState<ReadonlySet<string>>(new Set())

  const parId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const nomDe = (id: string) => {
    const p = parId.get(id)
    return p ? `${p.prenom} ${p.nom}`.trim() : 'Inconnu'
  }

  const suivis = useMemo(
    () => suiviParNote(affectations, (id) => estCadre(parId.get(id)?.role)),
    [affectations, parId]
  )
  const terme = recherche.trim().toLowerCase()
  const recherches = terme
    ? suivis.filter((s) => {
        const p = parId.get(s.evalueId)
        return `${p?.prenom ?? ''} ${p?.nom ?? ''} ${p?.matricule ?? ''}`.toLowerCase().includes(terme)
      })
    : suivis
  const visibles = trierSuivi(filtrerSuivi(recherches, filtre), tri, nomDe)

  // Nombre de notants dans chaque état, sur les notés retenus par la recherche
  const totalEtat = (f: FiltreEtat) =>
    f === 'TOUS' ? recherches.reduce((n, s) => n + s.notants.length, 0) : recherches.reduce((n, s) => n + s.compte[f], 0)

  const basculer = (id: string) =>
    setOuverts((o) => {
      const suivant = new Set(o)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  const toutOuvert = visibles.length > 0 && visibles.every((s) => ouverts.has(s.evalueId))

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Détail par noté</h3>
            <p className="text-xs text-slate-500 font-medium">Pour chaque collaborateur, les personnes qui doivent le noter et où elles en sont</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              Trier
              <select
                value={tri}
                onChange={(e) => setTri(e.target.value as TriSuivi)}
                className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              >
                <option value="RESTANTS">Notes en attente d’abord</option>
                <option value="NOM">Nom du noté</option>
              </select>
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
              <input
                type="search"
                aria-label="Rechercher un noté"
                placeholder="Rechercher un noté…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div role="group" aria-label="Filtrer les notants par état" className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 flex-wrap">
            {ORDRE_FILTRES.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtre === f}
                onClick={() => setFiltre(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums ${
                  filtre === f ? (f === 'TOUS' ? 'bg-slate-900 text-white' : ETATS[f].pastille) : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f === 'TOUS' ? 'Tous les notants' : ETATS[f].libelle} · {totalEtat(f)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOuverts(toutOuvert ? new Set() : new Set(visibles.map((s) => s.evalueId)))}
            className="text-xs font-semibold text-navy-700 hover:text-navy-900 underline"
          >
            {toutOuvert ? 'Tout replier' : 'Tout déplier'}
          </button>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {visibles.length === 0 && (
          <li className="p-8 text-center text-slate-500 font-medium">Aucun noté ne correspond aux filtres.</li>
        )}
        {visibles.map((s) => {
          const note = parId.get(s.evalueId)
          const ouvert = ouverts.has(s.evalueId)
          // Un cadre (facultatif) ne compte parmi les attendus que s'il a soumis ; un notant invalidé n'est plus attendu
          const attendus = s.compte.TERMINEE + s.restants
          const total = s.compte.TERMINEE + s.compte.BROUILLON + s.compte.EN_ATTENTE + s.compte.INVALIDEE
          const panneauId = `notants-${s.evalueId}`
          return (
            <li key={s.evalueId}>
              <button
                type="button"
                aria-expanded={ouvert}
                aria-controls={panneauId}
                onClick={() => basculer(s.evalueId)}
                className="w-full p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${ouvert ? 'rotate-180' : ''}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{nomDe(s.evalueId)}</p>
                    <p className="text-xs text-slate-500 font-medium truncate">
                      {note?.matricule ?? '—'}
                      {note?.service ? ` · ${note.service}` : ''} · {total} notant{total > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap md:justify-end">
                  <span className="text-xs font-bold tabular-nums text-slate-700" title="Notants attendus ayant soumis">
                    {s.compte.TERMINEE}/{attendus} terminé{s.compte.TERMINEE > 1 ? 's' : ''}
                  </span>
                  {s.restants > 0 ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                      {s.restants} en attente
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                      Complet
                    </span>
                  )}
                </div>
              </button>

              {ouvert && (
                <ul id={panneauId} className="mx-4 mb-4 md:mx-6 rounded-2xl ring-1 ring-slate-200 divide-y divide-slate-100">
                  {s.notants.map((n) => {
                    const notant = parId.get(n.evaluateurId)
                    return (
                      <li key={n.evaluateurId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{nomDe(n.evaluateurId)}</p>
                          <p className="text-2xs text-slate-500 truncate">
                            {libelleRole(notant?.role ?? '')}
                            {notant?.matricule ? ` · ${notant.matricule}` : ''}
                            {notant?.service ? ` · ${notant.service}` : ''}
                          </p>
                        </div>
                        <BadgeEtat etat={n.etat} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
