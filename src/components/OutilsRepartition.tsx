'use client'

import { useMemo, useState } from 'react'
import { CircleCheck, ClipboardCheck, Loader2, RotateCcw, Users, X } from 'lucide-react'
import { confirmer, toast } from '@/components/ui/feedback'
import { controlerRepartition, grouperParService, type AgentControle, type AffectationControle } from '@/lib/controle-repartition'

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Disposition de la répartition à ouvrir sur un agent : en tant que noté ou en tant que notant. */
export type PerspectiveRepartition = 'BY_EVALUE' | 'BY_EVALUATEUR'

/**
 * Onglet Répartition : affecter les Pairs d'un même service entre eux, remettre la répartition à zéro,
 * ou contrôler en un clic les Pairs sans notant, sans noté ou sans manager.
 */
export default function OutilsRepartition({
  campagneId,
  agents,
  affectations,
  onUpdate,
  onSelectionner,
}: {
  campagneId: string
  agents: AgentControle[]
  affectations: (AffectationControle & { statut: string })[]
  onUpdate: () => void
  /** Ouvre la répartition sur cet agent, pour corriger un manque signalé par le contrôle. */
  onSelectionner: (agentId: string, perspective: PerspectiveRepartition) => void
}) {
  const [enCours, setEnCours] = useState<'service' | 'reset' | null>(null)
  const [controleOuvert, setControleOuvert] = useState(false)
  const controle = useMemo(() => controlerRepartition(agents, affectations), [agents, affectations])
  const nbAlertes = controle.sansNotant.length + controle.sansNote.length + controle.sansManager.length
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
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-bold text-slate-900">Répartition rapide</p>
          <p className="text-xs text-slate-500">
            {affectations.length > 0 ? `${pluriel(affectations.length, 'affectation')} dans cette campagne.` : 'Aucune affectation pour le moment.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setControleOuvert((v) => !v)}
            aria-expanded={controleOuvert}
            aria-controls="controle-repartition"
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
              controleOuvert ? 'border-navy-300 bg-navy-50 text-navy-900' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            Contrôler la répartition
            <span
              className={`rounded-full px-2 py-0.5 text-2xs font-bold tabular-nums ${
                nbAlertes > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {nbAlertes > 0 ? nbAlertes : 'OK'}
            </span>
          </button>
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
  
      {controleOuvert && (
        <div id="controle-repartition" className="border-t border-slate-100 p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className="text-sm text-slate-600">
              Contrôle des <strong className="text-slate-900">{pluriel(controle.nbPairs, 'Pair')}</strong>. Cliquez sur un nom pour corriger sa
              répartition ci-dessous. Les affectations invalidées (force majeure) ne comptent pas.
            </p>
            <button
              type="button"
              onClick={() => setControleOuvert(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fermer le contrôle"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
  
          {nbAlertes === 0 ? (
            <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
              <CircleCheck className="h-4 w-4" aria-hidden />
              Tous les Pairs ont au moins un notant, un noté et un manager.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <ListeControle
                titre="Sans notant"
                consequence="Aucun évaluateur : pas de score."
                grave
                agents={controle.sansNotant}
                onChoisir={(id) => onSelectionner(id, 'BY_EVALUE')}
              />
              <ListeControle
                titre="Sans manager"
                consequence="Aucun manager hiérarchique : 0 sur le bloc manager."
                grave
                agents={controle.sansManager}
                onChoisir={(id) => onSelectionner(id, 'BY_EVALUE')}
              />
              <ListeControle
                titre="Sans noté"
                consequence="Personne à noter : son avis manque à ses collègues."
                agents={controle.sansNote}
                onChoisir={(id) => onSelectionner(id, 'BY_EVALUATEUR')}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Une liste du contrôle : agents regroupés par service, chaque nom ouvrant la répartition sur cet agent. */
function ListeControle({
  titre,
  consequence,
  grave = false,
  agents,
  onChoisir,
}: {
  titre: string
  consequence: string
  grave?: boolean
  agents: AgentControle[]
  onChoisir: (agentId: string) => void
}) {
  const vide = agents.length === 0
  const teinte = vide ? 'emerald' : grave ? 'red' : 'amber'
  const styles = {
    emerald: { cadre: 'ring-emerald-200 bg-emerald-50/40', pastille: 'bg-emerald-100 text-emerald-800' },
    red: { cadre: 'ring-red-200 bg-red-50/40', pastille: 'bg-red-100 text-red-800' },
    amber: { cadre: 'ring-amber-200 bg-amber-50/40', pastille: 'bg-amber-100 text-amber-800' },
  }[teinte]

  return (
    <section className={`rounded-2xl p-4 ring-1 ${styles.cadre}`} aria-label={titre}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-900">{titre}</h4>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${styles.pastille}`}>{agents.length}</span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{consequence}</p>

      {vide ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Aucun Pair concerné.
        </p>
      ) : (
        <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
          {grouperParService(agents).map(([service, liste]) => (
            <div key={service}>
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                {service} · {liste.length}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {liste.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onChoisir(a.id)}
                      title={`Ouvrir la répartition de ${a.prenom} ${a.nom} (${a.matricule})`}
                      className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-200 transition-colors hover:bg-navy-50 hover:text-navy-900 hover:ring-navy-300"
                    >
                      {a.nom} {a.prenom}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
