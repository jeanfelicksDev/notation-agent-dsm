'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ClipboardList, Plus, Trophy } from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'

interface Campagne {
  id: string
  libelle: string
  dateDebut: string
  dateFin: string
  statut: string
  poidsCollegues: number
  poidsManager: number
  _count: { criteres: number; affectations: number }
}

const STATUTS: Record<string, { label: string; className: string }> = {
  OUVERTE: { label: 'Ouverte', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  CLOTUREE: { label: 'Clôturée', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  CALCULEE: { label: 'Classement enregistré', className: 'bg-navy-50 text-navy-800 ring-navy-200' },
}

const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export default function CampagnesPage() {
  const [campagnes, setCampagnes] = useState<Campagne[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')
  const [annee, setAnnee] = useState<number>(new Date().getFullYear())

  useEffect(() => {
    fetch('/api/admin/campagnes')
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = '/?reason=admin_required'
          return
        }
        const data = await res.json()
        if (Array.isArray(data)) setCampagnes(data)
        else setErreur(data.error || 'Impossible de charger les campagnes.')
      })
      .catch(() => setErreur('Connexion au serveur impossible.'))
      .finally(() => setLoading(false))
  }, [])

  const annees = useMemo(() => {
    const ys = [...new Set(campagnes.map((c) => new Date(c.dateDebut).getFullYear()))].sort((a, b) => b - a)
    return ys.length ? ys : [new Date().getFullYear()]
  }, [campagnes])

  const anneeEffective = annees.includes(annee) ? annee : annees[0]

  return (
    <>
      <AdminHeader
        title="Campagnes"
        subtitle="Une seule campagne peut être ouverte à la fois."
        actions={
          <>
            <div className="flex items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-300">
              <label htmlFor="annee" className="sr-only">
                Année du palmarès
              </label>
              <select
                id="annee"
                value={anneeEffective}
                onChange={(e) => setAnnee(Number(e.target.value))}
                className="h-10 border-r border-slate-200 bg-transparent px-3 text-sm text-slate-700 outline-none"
              >
                {annees.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <Link
                href={`/admin/classement?campagneId=ANNUEL_${anneeEffective}`}
                className="inline-flex h-10 items-center gap-2 px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Trophy className="h-4 w-4 text-gold-600" aria-hidden />
                Palmarès annuel
              </Link>
            </div>
            <Link
              href="/admin/campagnes/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nouvelle campagne
            </Link>
          </>
        }
      />

      <main className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-[var(--radius-card)] bg-white" />
            ))}
          </div>
        ) : erreur ? (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {erreur}
          </p>
        ) : campagnes.length === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-white px-6 py-16 text-center shadow-card">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-navy-900">Aucune campagne pour le moment</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
              Une campagne regroupe les critères, les affectations et le classement d’une période d’évaluation.
            </p>
            <Link
              href="/admin/campagnes/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Créer la première campagne
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card">
            {campagnes.map((c) => {
              const statut = STATUTS[c.statut]
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/campagnes/${c.id}`}
                    className="group flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-base font-semibold text-navy-900">{c.libelle}</h2>
                        {statut && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statut.className}`}>{statut.label}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {fmt(c.dateDebut)} – {fmt(c.dateFin)}
                        <span className="text-slate-300"> · </span>
                        {c._count.criteres} critères
                        <span className="text-slate-300"> · </span>
                        {c._count.affectations} affectations
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 tabular-nums sm:text-right">
                      Manager <strong className="font-semibold text-slate-900">{c.poidsManager}</strong>
                      <span className="text-slate-300"> / </span>
                      Collègues & clients <strong className="font-semibold text-slate-900">{c.poidsCollegues}</strong>
                    </p>
                    <ChevronRight className="hidden h-5 w-5 text-slate-300 transition-colors group-hover:text-navy-700 sm:block" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
