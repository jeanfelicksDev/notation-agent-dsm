'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, Pencil, Plus, Settings2, Star, Trash2, X } from 'lucide-react'
import { confirmer, toast } from '@/components/ui/feedback'
import { ROLES } from '@/lib/roles'
import { LISTES_VIDES, TITRES_LISTES, memeLibelle, type Listes, type NomListe, type ValeurListe } from '@/lib/listes'

/** Listes déroulantes des fiches agents, chargées une fois par écran. */
export function useListes(onCharge?: (l: Listes) => void) {
  const [listes, setListes] = useState<Listes>(LISTES_VIDES)
  const [pret, setPret] = useState(false)
  const rappel = useRef(onCharge)

  useEffect(() => {
    let annule = false
    fetch('/api/admin/listes')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        if (annule) return
        setListes(data)
        rappel.current?.(data)
      })
      .catch(() => !annule && toast.error('Impossible de charger les listes déroulantes.'))
      .finally(() => !annule && setPret(true))
    return () => {
      annule = true
    }
  }, [])

  return { listes, setListes, pret }
}

type Reponse = { listes?: Listes; message?: string; error?: string }

async function appeler(url: string, method: string, body?: unknown): Promise<Reponse> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data: Reponse = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || 'L’opération a échoué.' }
    return data
  } catch {
    return { error: 'Connexion au serveur impossible.' }
  }
}

/**
 * Gestion d'une liste : ajout, renommage (avec mise à jour des fiches), valeur par défaut, suppression.
 * Les rôles ne se renomment que par leur libellé.
 */
export function GestionListe({
  liste,
  listes,
  onListes,
  onRenomme,
}: {
  liste: NomListe
  listes: Listes
  onListes: (l: Listes) => void
  onRenomme?: (ancien: string, nouveau: string) => void
}) {
  const valeurs = listes[liste]
  const estRole = liste === 'ROLE'
  const [ajout, setAjout] = useState('')
  const [edition, setEdition] = useState<{ id: string; libelle: string } | null>(null)
  const [occupe, setOccupe] = useState<string | null>(null)

  const appliquer = (r: Reponse) => {
    if (r.error) {
      toast.error(r.error)
      return false
    }
    if (r.listes) onListes(r.listes)
    if (r.message) toast.success(r.message)
    return true
  }

  const ajouter = async () => {
    const libelle = ajout.trim()
    if (!libelle) return
    setOccupe('ajout')
    if (appliquer(await appeler('/api/admin/listes', 'POST', { liste, libelle }))) setAjout('')
    setOccupe(null)
  }

  const renommer = async (v: ValeurListe) => {
    if (!edition) return
    const libelle = edition.libelle.trim()
    if (!libelle || libelle === v.libelle) return setEdition(null)
    if (v.utilisations > 0 && !estRole) {
      const fusion = valeurs.find((x) => x.id !== v.id && memeLibelle(x.libelle, libelle))
      const ok = await confirmer({
        titre: fusion ? `Fusionner dans « ${fusion.libelle} » ?` : 'Renommer cette valeur ?',
        message: fusion
          ? `Les ${v.utilisations} fiche(s) « ${v.libelle} » passeront à « ${fusion.libelle} », puis « ${v.libelle} » sera retiré de la liste.`
          : `Les ${v.utilisations} fiche(s) qui portent « ${v.libelle} » seront mises à jour.`,
        confirmer: fusion ? 'Fusionner' : 'Renommer',
      })
      if (!ok) return
    }
    setOccupe(v.id)
    const r = await appeler(`/api/admin/listes/${v.id}`, 'PATCH', { libelle })
    if (appliquer(r)) {
      setEdition(null)
      const final = r.listes?.[liste].find((x) => memeLibelle(x.libelle, libelle))?.libelle ?? libelle
      onRenomme?.(v.libelle, final)
    }
    setOccupe(null)
  }

  const basculerDefaut = async (v: ValeurListe) => {
    setOccupe(v.id)
    appliquer(await appeler(`/api/admin/listes/${v.id}`, 'PATCH', { parDefaut: !v.parDefaut }))
    setOccupe(null)
  }

  const supprimer = async (v: ValeurListe) => {
    if (v.utilisations > 0) {
      toast.error(
        `« ${v.libelle} » est utilisé par ${v.utilisations} agent(s). Renommez-le vers une autre valeur pour les regrouper.`
      )
      return
    }
    const ok = await confirmer({
      titre: `Supprimer « ${v.libelle} » ?`,
      message: 'Aucune fiche ne l’utilise. La valeur ne sera plus proposée.',
      confirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    setOccupe(v.id)
    appliquer(await appeler(`/api/admin/listes/${v.id}`, 'DELETE'))
    setOccupe(null)
  }

  const bouton = 'rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40'

  return (
    <div>
      <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {valeurs.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Aucune valeur pour l’instant.</li>}
        {valeurs.map((v) => (
          <li key={v.id} className="flex items-center gap-2 px-3 py-2">
            {edition?.id === v.id ? (
              <form
                className="flex flex-1 items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  renommer(v)
                }}
              >
                <input
                  autoFocus
                  aria-label={`Nouveau libellé de « ${v.libelle} »`}
                  value={edition.libelle}
                  maxLength={120}
                  onChange={(e) => setEdition({ id: v.id, libelle: e.target.value })}
                  onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), e.stopPropagation(), setEdition(null))}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15"
                />
                <button type="submit" className={`${bouton} text-emerald-600 hover:text-emerald-700`} disabled={occupe === v.id} aria-label="Valider">
                  {occupe === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button type="button" className={bouton} onClick={() => setEdition(null)} aria-label="Annuler">
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {v.libelle}
                  {v.parDefaut && (
                    <span className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-medium text-gold-800 ring-1 ring-gold-200">
                      par défaut
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-400" title="Fiches agents qui portent cette valeur">
                  {v.utilisations} agent{v.utilisations > 1 ? 's' : ''}
                </span>
                {!estRole && (
                  <button
                    type="button"
                    className={`${bouton} ${v.parDefaut ? 'text-gold-500 hover:text-gold-600' : ''}`}
                    onClick={() => basculerDefaut(v)}
                    disabled={occupe === v.id}
                    aria-label={v.parDefaut ? 'Ne plus proposer par défaut' : 'Proposer par défaut aux nouveaux agents'}
                    title={v.parDefaut ? 'Ne plus proposer par défaut' : 'Proposer par défaut aux nouveaux agents'}
                  >
                    <Star className="h-4 w-4" fill={v.parDefaut ? 'currentColor' : 'none'} />
                  </button>
                )}
                <button
                  type="button"
                  className={bouton}
                  onClick={() => setEdition({ id: v.id, libelle: v.libelle })}
                  aria-label={`Renommer « ${v.libelle} »`}
                  title="Renommer"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {!estRole && (
                  <button
                    type="button"
                    className={`${bouton} hover:bg-red-50 hover:text-red-600`}
                    onClick={() => supprimer(v)}
                    disabled={occupe === v.id}
                    aria-label={`Supprimer « ${v.libelle} »`}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {estRole ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Les quatre rôles déterminent les accès (PIN, administration, portail client) : leurs libellés se renomment, mais on
          ne peut ni en ajouter ni en supprimer.
        </p>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            ajouter()
          }}
        >
          <input
            value={ajout}
            onChange={(e) => setAjout(e.target.value)}
            maxLength={120}
            placeholder="Nouvelle valeur"
            aria-label={`Ajouter aux ${TITRES_LISTES[liste].toLowerCase()}`}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15"
          />
          <button
            type="submit"
            disabled={!ajout.trim() || occupe === 'ajout'}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-navy-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
          >
            {occupe === 'ajout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ajouter
          </button>
        </form>
      )}
    </div>
  )
}

function DialogueListe({
  liste,
  listes,
  onListes,
  onRenomme,
  onFermer,
}: {
  liste: NomListe
  listes: Listes
  onListes: (l: Listes) => void
  onRenomme: (ancien: string, nouveau: string) => void
  onFermer: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // Rendu hors du formulaire de la fiche : ses champs ne doivent pas le soumettre.
  return createPortal(
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onFermer()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onFermer()
      }}
      aria-labelledby="titre-liste"
      className="m-auto w-[calc(100%-2rem)] max-w-lg animate-rise-in rounded-2xl bg-white p-0 text-slate-900 shadow-overlay backdrop:bg-navy-950/45"
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="titre-liste" className="font-display text-xl text-navy-900">
              {TITRES_LISTES[liste]}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {liste === 'ROLE' ? 'Libellés affichés pour chaque rôle.' : 'Valeurs proposées dans les fiches agents.'}
            </p>
          </div>
          <button type="button" onClick={onFermer} className="-m-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <GestionListe liste={liste} listes={listes} onListes={onListes} onRenomme={onRenomme} />
        </div>
      </div>
    </dialog>,
    document.body
  )
}

/** Liste déroulante d'une fiche agent, avec un accès direct à la gestion de ses valeurs. */
export function ChampListe({
  id,
  label,
  liste,
  value,
  onChange,
  listes,
  onListes,
  labelClassName = 'block text-sm font-medium text-gray-700',
  selectClassName,
}: {
  id: string
  label: string
  liste: NomListe
  value: string
  onChange: (v: string) => void
  listes: Listes
  onListes: (l: Listes) => void
  labelClassName?: string
  selectClassName: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const estRole = liste === 'ROLE'
  const options =
    estRole && listes.ROLE.length === 0
      ? ROLES.map((r) => ({ valeur: r.valeur as string, libelle: r.libelle as string }))
      : listes[liste].map((v) => ({ valeur: estRole ? v.code ?? v.libelle : v.libelle, libelle: v.libelle }))
  // Une fiche peut porter une valeur absente de la liste (saisie ancienne) : elle reste affichée.
  const horsListe = Boolean(value) && !options.some((o) => (estRole ? o.valeur === value : memeLibelle(o.valeur, value)))
  const selection = estRole ? value : options.find((o) => memeLibelle(o.valeur, value))?.valeur ?? value

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-navy-700 hover:bg-navy-50 hover:text-navy-900"
          title={`Gérer la liste des ${TITRES_LISTES[liste].toLowerCase()}`}
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          Gérer
        </button>
      </div>
      <select id={id} className={selectClassName} value={selection} onChange={(e) => onChange(e.target.value)}>
        {!estRole && <option value="">Non renseigné</option>}
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
        {horsListe && <option value={value}>{value} (hors liste)</option>}
      </select>
      {ouvert && (
        <DialogueListe
          liste={liste}
          listes={listes}
          onListes={onListes}
          onRenomme={(ancien, nouveau) => {
            if (!estRole && memeLibelle(value, ancien)) onChange(nouveau)
          }}
          onFermer={() => setOuvert(false)}
        />
      )}
    </div>
  )
}
