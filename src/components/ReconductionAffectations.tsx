'use client'

import { useEffect, useState } from 'react'
import { CopyPlus, Loader2 } from 'lucide-react'
import { confirmer, toast } from '@/components/ui/feedback'

export type CampagneSource = { id: string; libelle: string; nbAffectations: number }

type CampagneApi = { id: string; libelle: string; _count?: { affectations?: number } }

/** Campagnes qui ont des affectations à reconduire (hors `exclureId`), de la plus récente à la plus ancienne. */
export function useCampagnesSources(exclureId?: string): CampagneSource[] {
  const [sources, setSources] = useState<CampagneSource[]>([])

  useEffect(() => {
    let actif = true
    fetch('/api/admin/campagnes')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!actif || !Array.isArray(data)) return
        setSources(
          (data as CampagneApi[])
            .map((c) => ({ id: c.id, libelle: c.libelle, nbAffectations: c._count?.affectations ?? 0 }))
            .filter((c) => c.id !== exclureId && c.nbAffectations > 0)
        )
      })
      .catch(() => {})
    return () => {
      actif = false
    }
  }, [exclureId])

  return sources
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Onglet Répartition : remplace les affectations de la campagne par celles d'une autre campagne. */
export default function ReconductionAffectations({
  campagneId,
  nbActuelles,
  onUpdate,
}: {
  campagneId: string
  nbActuelles: number
  onUpdate: () => void
}) {
  const sources = useCampagnesSources(campagneId)
  const [sourceId, setSourceId] = useState('')
  const [enCours, setEnCours] = useState(false)

  if (sources.length === 0) return null
  const source = sources.find((s) => s.id === sourceId)

  const reconduire = async () => {
    if (!source) return
    const ok = await confirmer({
      titre: 'Reconduire les affectations ?',
      message: (
        <>
          Les {pluriel(source.nbAffectations, 'affectation')} de « {source.libelle} » seront recopiées, avec leurs désignations « client
          interne ». Les statuts repartent de zéro.
          {nbActuelles > 0 && (
            <>
              {' '}
              Les <strong>{pluriel(nbActuelles, 'affectation')} actuelle{nbActuelles > 1 ? 's' : ''}</strong> de cette campagne et leurs
              notes en brouillon seront <strong>supprimées</strong>.
            </>
          )}
        </>
      ),
      confirmer: 'Reconduire',
      danger: nbActuelles > 0,
    })
    if (!ok) return

    setEnCours(true)
    try {
      const r = await fetch(`/api/admin/campagnes/${campagneId}/reconduire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(data.error || 'La reconduction a échoué.')
        return
      }
      toast.success(data.message || 'Affectations reconduites.')
      setSourceId('')
      onUpdate()
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-50 text-gold-700 ring-1 ring-gold-200">
          <CopyPlus className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Reconduire les affectations d’une autre campagne</p>
          <p className="text-xs text-slate-500">
            {nbActuelles > 0
              ? `Remplace les ${pluriel(nbActuelles, 'affectation')} actuelle${nbActuelles > 1 ? 's' : ''} de cette campagne.`
              : 'Reprend les paires notant → noté et les désignations « client interne ».'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="source-reconduction" className="sr-only">
          Campagne source
        </label>
        <select
          id="source-reconduction"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          disabled={enCours}
          className="h-10 min-w-[16rem] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15"
        >
          <option value="">Choisir la campagne source…</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.libelle} ({pluriel(s.nbAffectations, 'affectation')})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={reconduire}
          disabled={!source || enCours}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-800 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CopyPlus className="h-4 w-4" aria-hidden />}
          Reconduire
        </button>
      </div>
    </div>
  )
}
