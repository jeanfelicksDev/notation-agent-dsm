'use client'

import { useState } from 'react'
import { Loader2, RotateCcw, Users } from 'lucide-react'
import { confirmer, toast } from '@/components/ui/feedback'

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Onglet Répartition : affecter les Pairs d'un même service entre eux, ou remettre la répartition à zéro. */
export default function OutilsRepartition({
  campagneId,
  affectations,
  onUpdate,
}: {
  campagneId: string
  affectations: { statut: string }[]
  onUpdate: () => void
}) {
  const [enCours, setEnCours] = useState<'service' | 'reset' | null>(null)
  const soumises = affectations.filter((a) => a.statut === 'TERMINEE').length

  const appeler = async (action: 'service' | 'reset', requete: RequestInit, succes: (data: Record<string, number>) => string) => {
    setEnCours(action)
    try {
      const r = await fetch(`/api/admin/campagnes/${campagneId}/affectations`, requete)
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(data.error || 'L’opération a échoué.')
        return
      }
      toast.success(succes(data))
      onUpdate()
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setEnCours(null)
    }
  }

  const affecterPairsDuService = async () => {
    const ok = await confirmer({
      titre: 'Affecter les pairs du même service ?',
      message:
        'Chaque Pair sera noté par tous les autres Pairs de son service. Seules les paires manquantes sont ajoutées : les affectations existantes restent intactes.',
      confirmer: 'Affecter',
    })
    if (!ok) return
    appeler(
      'service',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'pairs_service' }) },
      (d) => (d.ajoutees ? `${pluriel(d.ajoutees, 'affectation')} ajoutée${d.ajoutees > 1 ? 's' : ''}.` : 'Tous les pairs d’un même service étaient déjà affectés entre eux.')
    )
  }

  const reinitialiser = async () => {
    const ok = await confirmer({
      titre: 'Réinitialiser toutes les affectations ?',
      message: (
        <>
          Les <strong>{pluriel(affectations.length, 'affectation')}</strong> de cette campagne seront supprimées, avec toutes les notes
          internes qui en dépendent.
          {soumises > 0 && (
            <>
              {' '}
              <strong>
                {pluriel(soumises, 'évaluation')} déjà soumise{soumises > 1 ? 's' : ''} {soumises > 1 ? 'seront perdues' : 'sera perdue'}.
              </strong>
            </>
          )}{' '}
          Les avis clients (QR) sont conservés. Cette action est irréversible.
        </>
      ),
      confirmer: 'Réinitialiser',
      danger: true,
      saisieRequise: 'RÉINITIALISER',
    })
    if (!ok) return
    appeler('reset', { method: 'DELETE' }, (d) => `${pluriel(d.affectations ?? 0, 'affectation')} supprimée${(d.affectations ?? 0) > 1 ? 's' : ''}.`)
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <p className="text-sm font-bold text-slate-900">Répartition rapide</p>
        <p className="text-xs text-slate-500">
          {affectations.length > 0 ? `${pluriel(affectations.length, 'affectation')} dans cette campagne.` : 'Aucune affectation pour le moment.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={affecterPairsDuService}
          disabled={enCours !== null}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-800 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enCours === 'service' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Users className="h-4 w-4" aria-hidden />}
          Affecter les pairs du même service
        </button>
        <button
          type="button"
          onClick={reinitialiser}
          disabled={enCours !== null || affectations.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enCours === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
          Réinitialiser
        </button>
      </div>
    </div>
  )
}
