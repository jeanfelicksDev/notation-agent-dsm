'use client'

import { useId } from 'react'
import { ShieldCheck, TriangleAlert, UserX } from 'lucide-react'
import { LIBELLES_SITUATION, prevoirSituations, SITUATIONS_NON_CLASSEES, type SituationScore } from '@/lib/eligibilite'

/**
 * Affichage des notants défaillants (règles : src/lib/eligibilite.ts) : pastille de situation,
 * liste des agents non classés et prévision de l'onglet Suivi.
 */

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

const STYLES: Record<Exclude<SituationScore, 'COMPLET'>, string> = {
  PROTEGE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  PENALISE: 'bg-amber-50 text-amber-800 ring-amber-200',
  SANS_MANAGER: 'bg-rose-50 text-rose-800 ring-rose-200',
  NON_NOTANT: 'bg-violet-50 text-violet-800 ring-violet-200',
  SEUIL_NON_ATTEINT: 'bg-orange-50 text-orange-800 ring-orange-200',
}

type PropsBadge = { situation?: SituationScore | null; nbNotants?: number; nbNotantsAttendus?: number }

/** Pastille de situation ; rien pour un agent complet ou en règle historique. */
export function BadgeSituation({ situation, nbNotants = 0, nbNotantsAttendus = 0 }: PropsBadge) {
  if (!situation || situation === 'COMPLET') return null
  const { libelle, description } = LIBELLES_SITUATION[situation]
  const detail = `${nbNotants} notant${nbNotants > 1 ? 's' : ''} sur ${nbNotantsAttendus} ont soumis. ${description}`
  return (
    <span
      title={detail}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold ring-1 ${STYLES[situation]}`}
    >
      {libelle} · {nbNotants}/{nbNotantsAttendus}
      <span className="sr-only">{detail}</span>
    </span>
  )
}

/** Explication d'une situation, pour la fiche détail d'un agent. */
export function texteSituation(situation: SituationScore | null | undefined, nbNotants = 0, nbNotantsAttendus = 0): string | null {
  if (!situation || situation === 'COMPLET') return null
  const defaillants = nbNotantsAttendus - nbNotants
  const manquants = `${pluriel(defaillants, 'notant')} n'${defaillants > 1 ? 'ont' : 'a'} pas soumis`
  if (situation === 'PROTEGE') {
    return `${manquants}, mais ${nbNotants} notants, manager compris, ont noté : son score n'est pas pénalisé.`
  }
  if (situation === 'PENALISE') {
    return `${manquants} et seuls ${nbNotants} ont noté, sous le seuil : chaque notant manquant compte 0 (ancienne règle).`
  }
  if (situation === 'SEUIL_NON_ATTEINT') {
    return `Seuls ${pluriel(nbNotants, 'notant')} sur ${nbNotantsAttendus} ${nbNotants > 1 ? 'ont' : 'a'} soumis, sous le seuil : il n'est pas classé. Le score affiché est indicatif.`
  }
  if (situation === 'NON_NOTANT') {
    return `${LIBELLES_SITUATION.NON_NOTANT.description} Le score affiché est indicatif.`
  }
  return LIBELLES_SITUATION.SANS_MANAGER.description
}

type AgentNonClasse = {
  situation?: SituationScore | null
  utilisateurId: string
  nom: string
  prenom: string
  matricule: string
  service: string
  scoreTotal: number
  nbNotants?: number
  nbNotantsAttendus?: number
}

/** Agents hors classement et palmarès, avec le motif et leur score indicatif. */
export function ListeNonClasses({ agents, anonymise = false }: { agents: AgentNonClasse[]; anonymise?: boolean }) {
  const titreId = useId()
  if (agents.length === 0) return null
  return (
    <section aria-labelledby={titreId} className="rounded-3xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <UserX className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden />
        <div>
          <h3 id={titreId} className="text-sm font-bold text-slate-900">
            Non classés · {agents.length}
          </h3>
          <p className="text-xs text-slate-600">
            Ils ne figurent ni au classement ni au palmarès : ils n’ont pas soumis leurs propres évaluations, n’ont pas
            reçu la note de leur manager, ou trop peu de notants les ont évalués. Le score affiché est indicatif.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <li key={a.utilisateurId} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-rose-100">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{anonymise ? `Agent ${a.matricule}` : `${a.prenom} ${a.nom}`}</p>
              <p className="truncate text-2xs text-slate-500">
                {a.service} · {a.nbNotants ?? 0}/{a.nbNotantsAttendus ?? 0} notants
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {a.situation && a.situation !== 'COMPLET' && (
                <span
                  title={LIBELLES_SITUATION[a.situation].description}
                  className={`rounded-full px-2 py-0.5 text-2xs font-bold ring-1 ${STYLES[a.situation]}`}
                >
                  {LIBELLES_SITUATION[a.situation].libelle}
                </span>
              )}
              <span className="text-xs font-bold tabular-nums text-slate-500" title="Score indicatif">
                {a.scoreTotal.toFixed(1)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

type AffectationSuivi = { evaluateurId: string; evalueId: string; statut: string; invalidee?: boolean; clientInterne?: boolean }
type PersonneSuivi = { id: string; nom: string; prenom: string; role: string }

function Tuile({ libelle, nombre, teinte }: { libelle: string; nombre: number; teinte: string }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${teinte}`}>
      <p className="text-xs font-semibold">{libelle}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{nombre}</p>
    </div>
  )
}

/**
 * Onglet Suivi : situation de chaque Pair noté si la campagne était clôturée maintenant,
 * et managers dont le retard ferait sortir des agents du classement.
 */
export function PrevisionSituations({
  affectations,
  personnes,
  seuilNotants,
}: {
  affectations: AffectationSuivi[]
  personnes: PersonneSuivi[]
  seuilNotants: number | null
}) {
  if (seuilNotants === null) return null
  const parId = new Map(personnes.map((p) => [p.id, p]))
  const { previsions, managersEnRetard } = prevoirSituations(
    affectations.map((a) => ({
      evaluateurId: a.evaluateurId,
      evalueId: a.evalueId,
      statut: a.statut,
      invalidee: !!a.invalidee,
      clientInterne: !!a.clientInterne,
      roleEvaluateur: parId.get(a.evaluateurId)?.role,
    })),
    seuilNotants,
    (id) => parId.get(id)?.role === 'UTILISATEUR'
  )
  if (previsions.length === 0) return null

  const compter = (s: SituationScore) => previsions.filter((p) => p.situation === s).length
  const nomDe = (id: string) => {
    const p = parId.get(id)
    return p ? `${p.prenom} ${p.nom}` : 'Inconnu'
  }
  const aRisque = previsions
    .filter((p) => SITUATIONS_NON_CLASSEES.includes(p.situation))
    .sort((a, b) => nomDe(a.evalueId).localeCompare(nomDe(b.evalueId), 'fr'))

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy-700" aria-hidden />
        <div>
          <h3 className="text-base font-semibold text-slate-900">Si la campagne était clôturée maintenant</h3>
          <p className="text-xs text-slate-500">
            Pour être classé : avoir soumis ses propres évaluations, avoir la note de son manager et au moins{' '}
            {pluriel(seuilNotants, 'notant')} ayant soumis, manager compris. Les cadres (vote facultatif) et les clients
            externes ne comptent pas ; sans note de client externe, la part clients est simplement annulée.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tuile libelle="Complets" nombre={compter('COMPLET')} teinte="bg-slate-50 text-slate-800 ring-slate-200" />
        <Tuile libelle="Protégés" nombre={compter('PROTEGE')} teinte="bg-emerald-50 text-emerald-800 ring-emerald-200" />
        <Tuile libelle="N’ont pas noté" nombre={compter('NON_NOTANT')} teinte={STYLES.NON_NOTANT} />
        <Tuile libelle="Sous le seuil" nombre={compter('SEUIL_NON_ATTEINT')} teinte={STYLES.SEUIL_NON_ATTEINT} />
        <Tuile libelle="Sans manager" nombre={compter('SANS_MANAGER')} teinte={STYLES.SANS_MANAGER} />
      </div>

      {managersEnRetard.size > 0 && (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-rose-200">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="h-4 w-4" aria-hidden /> Managers à relancer : sans leur note, ces agents ne seront pas classés.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {[...managersEnRetard].map(([id, nb]) => (
              <li key={id} className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium ring-1 ring-rose-200">
                {nomDe(id)} · {pluriel(nb, 'agent')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {aRisque.length > 0 && (
        <details className="rounded-2xl ring-1 ring-slate-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
            Agents qui ne seraient pas classés · {aRisque.length}
          </summary>
          <ul className="flex flex-wrap gap-2 px-4 pb-4">
            {aRisque.map((p) => (
              <li key={p.evalueId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-800">
                {nomDe(p.evalueId)}
                <BadgeSituation situation={p.situation} nbNotants={p.bilan.nbNotants} nbNotantsAttendus={p.bilan.nbAttendus} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
