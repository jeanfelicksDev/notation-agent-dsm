'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CloudOff,
  LayoutList,
  Loader2,
  Lock,
  LogOut,
  Rows3,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react'
import { getAppreciationInfo, getAppreciationOptions } from '@/lib/default-criteres'
import { BrandMark } from '@/components/BrandMark'
import { confirmer, toast } from '@/components/ui/feedback'
import { libelleCampagne } from '@/lib/libelle'

/* ─── Types ─────────────────────────────────────────────────────── */

interface Critere {
  id: string
  libelle: string
  description: string | null
  noteMaximale: number
}

interface Affectation {
  id: string
  evalueId: string
  statut: 'EN_ATTENTE' | 'BROUILLON' | 'TERMINEE'
  critereIds: string[]
  evalue: {
    id: string
    matricule: string
    nom: string
    prenom: string
    service: string | null
    emploi: string | null
  }
}

interface Evaluateur {
  id: string
  prenom: string
  nom: string
  role: string
}

interface Campagne {
  id: string
  libelle: string
  dateFin: string
  ouverte: boolean
  messagePeriode: string | null
}

type NoteState = { valeur: number; commentaire: string }
type NotesMap = Record<string, Record<string, NoteState>>
type Sauvegarde = { etat: 'idle' | 'pending' | 'saving' | 'saved' | 'error'; at?: Date }

const AUTOSAVE_MS = 1200
const MAX_COMMENTAIRE = 500

const nomComplet = (a: Affectation) => `${a.evalue.prenom} ${a.evalue.nom}`
const initiales = (a: Affectation) => `${a.evalue.prenom?.[0] ?? ''}${a.evalue.nom?.[0] ?? ''}`

/* ─── Page ──────────────────────────────────────────────────────── */

export default function EvaluerPage() {
  const router = useRouter()

  const [evaluateur, setEvaluateur] = useState<Evaluateur | null>(null)
  const [campagne, setCampagne] = useState<Campagne | null>(null)
  const [criteres, setCriteres] = useState<Critere[]>([])
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [isManager, setIsManager] = useState(false)
  const [notes, setNotes] = useState<NotesMap>({})

  const [currentIndex, setCurrentIndex] = useState(0)
  const [critereIndex, setCritereIndex] = useState(0)
  const [vue, setVue] = useState<'focus' | 'liste'>('focus')

  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sauvegarde, setSauvegarde] = useState<Sauvegarde>({ etat: 'idle' })

  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'a_faire' | 'termines'>('tous')
  const [tiroir, setTiroir] = useState(false)

  // Collaborateurs modifiés depuis la dernière sauvegarde réussie
  const sales = useRef(new Set<string>())
  const notesRef = useRef(notes)
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const critereParId = useMemo(() => new Map(criteres.map((c) => [c.id, c])), [criteres])
  const criteresDe = useCallback(
    (aff: Affectation | undefined) => (aff ? aff.critereIds.map((id) => critereParId.get(id)).filter((c): c is Critere => !!c) : []),
    [critereParId]
  )
  const valeur = (evalueId: string, critereId: string) => notes[evalueId]?.[critereId]?.valeur ?? 0

  const estComplet = useCallback(
    (aff: Affectation) => {
      const cs = criteresDe(aff)
      return cs.length > 0 && cs.every((c) => (notes[aff.evalueId]?.[c.id]?.valeur ?? 0) > 0)
    },
    [criteresDe, notes]
  )

  const lectureSeule = !campagne?.ouverte

  /* ─── Chargement ─── */

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/evaluation/init', { cache: 'no-store' })
      if (res.status === 401) {
        window.location.href = '/?reason=session_expired'
        return
      }
      const data = await res.json()
      if (data.redirect) {
        router.push(data.redirect)
        return
      }
      if (data.evaluateur) setEvaluateur(data.evaluateur)
      if (!res.ok) {
        setErreur(data.error || 'Impossible de charger vos évaluations.')
        return
      }

      setCampagne(data.campagne)
      setCriteres(data.criteres)
      setIsManager(Boolean(data.isManager))

      const affs: Affectation[] = data.affectations
      setAffectations(affs)

      const charge: NotesMap = {}
      for (const n of data.notes ?? []) {
        charge[n.evalueId] ??= {}
        charge[n.evalueId][n.critereId] = { valeur: n.valeur, commentaire: n.commentaire ?? '' }
      }
      setNotes(charge)

      if (affs.length > 0 && affs.every((a) => a.statut === 'TERMINEE')) {
        setSubmitted(true)
      } else {
        // Reprendre au premier collaborateur non terminé
        const reprise = affs.findIndex((a) => a.statut !== 'TERMINEE' && !a.critereIds.every((id) => (charge[a.evalueId]?.[id]?.valeur ?? 0) > 0))
        const idx = reprise >= 0 ? reprise : 0
        setCurrentIndex(idx)
        const premierVide = affs[idx]?.critereIds.findIndex((id) => !(charge[affs[idx].evalueId]?.[id]?.valeur > 0)) ?? -1
        setCritereIndex(Math.max(0, premierVide))
      }
    } catch {
      setErreur('Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    charger()
  }, [charger])

  const recharger = () => {
    setLoading(true)
    setErreur(null)
    charger()
  }

  /* ─── Sauvegarde automatique ─── */

  const sauvegarder = useCallback(
    async (evalueId: string) => {
      const aff = affectations.find((a) => a.evalueId === evalueId)
      if (!aff || aff.statut === 'TERMINEE' || lectureSeule) return true
      const payload = Object.entries(notesRef.current[evalueId] ?? {})
        .filter(([, n]) => n.valeur > 0)
        .map(([critereId, n]) => ({ critereId, valeur: n.valeur, commentaire: n.commentaire }))
      if (payload.length === 0) {
        sales.current.delete(evalueId)
        return true
      }

      setSauvegarde({ etat: 'saving' })
      try {
        const res = await fetch('/api/evaluation/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evalueId, notes: payload }),
        })
        if (res.status === 401) {
          window.location.href = '/?reason=session_expired'
          return false
        }
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Échec de l’enregistrement')
        sales.current.delete(evalueId)
        setAffectations((prev) => prev.map((a) => (a.evalueId === evalueId && a.statut === 'EN_ATTENTE' ? { ...a, statut: 'BROUILLON' } : a)))
        setSauvegarde({ etat: sales.current.size ? 'pending' : 'saved', at: new Date() })
        return true
      } catch (e) {
        setSauvegarde({ etat: 'error' })
        toast.error(e instanceof Error ? e.message : 'Échec de l’enregistrement du brouillon.')
        return false
      }
    },
    [affectations, lectureSeule]
  )

  const evalueCourant = affectations[currentIndex]?.evalueId
  useEffect(() => {
    if (!evalueCourant || !sales.current.has(evalueCourant)) return
    const t = setTimeout(() => sauvegarder(evalueCourant), AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [notes, evalueCourant, sauvegarder])

  // Prévenir avant de quitter la page avec des saisies non enregistrées
  useEffect(() => {
    const avant = (e: BeforeUnloadEvent) => {
      if (sales.current.size > 0) e.preventDefault()
    }
    window.addEventListener('beforeunload', avant)
    return () => window.removeEventListener('beforeunload', avant)
  }, [])

  const marquerModifie = (evalueId: string) => {
    sales.current.add(evalueId)
    setSauvegarde({ etat: 'pending' })
  }

  /* ─── Saisie ─── */

  const choisirNote = (aff: Affectation, critere: Critere, note: number) => {
    if (aff.statut === 'TERMINEE' || lectureSeule) return
    const premiereFois = valeur(aff.evalueId, critere.id) === 0
    setNotes((prev) => ({
      ...prev,
      [aff.evalueId]: {
        ...prev[aff.evalueId],
        [critere.id]: { valeur: note, commentaire: prev[aff.evalueId]?.[critere.id]?.commentaire ?? '' },
      },
    }))
    marquerModifie(aff.evalueId)

    // Auto-avance au critère suivant, seulement lors d'une première notation en mode focus
    const cs = criteresDe(aff)
    const idx = cs.findIndex((c) => c.id === critere.id)
    if (vue === 'focus' && premiereFois && idx < cs.length - 1) {
      setTimeout(() => setCritereIndex(idx + 1), 220)
    }
  }

  const changerCommentaire = (aff: Affectation, critereId: string, texte: string) => {
    setNotes((prev) => ({
      ...prev,
      [aff.evalueId]: {
        ...prev[aff.evalueId],
        [critereId]: { valeur: prev[aff.evalueId]?.[critereId]?.valeur ?? 0, commentaire: texte.slice(0, MAX_COMMENTAIRE) },
      },
    }))
    marquerModifie(aff.evalueId)
  }

  /* ─── Navigation ─── */

  const estDeverrouille = (idx: number) =>
    idx === 0 || affectations.slice(0, idx).every((a) => a.statut === 'TERMINEE' || estComplet(a))

  const allerA = async (idx: number) => {
    if (idx < 0 || idx >= affectations.length || idx === currentIndex || !estDeverrouille(idx)) return
    const quitte = affectations[currentIndex]
    if (quitte && sales.current.has(quitte.evalueId)) await sauvegarder(quitte.evalueId)
    setCurrentIndex(idx)
    const cible = affectations[idx]
    setCritereIndex(Math.max(0, cible.critereIds.findIndex((id) => valeur(cible.evalueId, id) === 0)))
    setTiroir(false)
  }

  /* ─── Soumission ─── */

  const ouvertes = affectations.filter((a) => a.statut !== 'TERMINEE')
  const nbComplets = affectations.filter((a) => a.statut === 'TERMINEE' || estComplet(a)).length
  const pret = ouvertes.length > 0 && ouvertes.every(estComplet)

  const soumettre = async () => {
    const incomplet = ouvertes.find((a) => !estComplet(a))
    if (incomplet) {
      const manquant = criteresDe(incomplet).find((c) => valeur(incomplet.evalueId, c.id) === 0)
      toast.error(`« ${manquant?.libelle} » n’est pas encore noté pour ${nomComplet(incomplet)}.`)
      allerA(affectations.indexOf(incomplet))
      return
    }

    const ok = await confirmer({
      titre: 'Soumettre définitivement vos évaluations ?',
      message: (
        <>
          Vous allez transmettre vos notes pour <strong>{ouvertes.length} collaborateur{ouvertes.length > 1 ? 's' : ''}</strong>.
          <br />
          Cette action est <strong>irréversible</strong> : vous ne pourrez plus modifier aucune note ni aucun commentaire.
        </>
      ),
      confirmer: 'Soumettre définitivement',
      annuler: 'Relire encore',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      const toutes = ouvertes.flatMap((a) =>
        criteresDe(a).map((c) => ({
          evalueId: a.evalueId,
          critereId: c.id,
          valeur: valeur(a.evalueId, c.id),
          commentaire: notes[a.evalueId]?.[c.id]?.commentaire ?? '',
        }))
      )
      const res = await fetch('/api/evaluation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: toutes }),
      })
      if (res.status === 401) {
        window.location.href = '/?reason=session_expired'
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'La soumission a échoué. Vos notes restent enregistrées en brouillon.')
        if (res.status === 409) recharger()
        return
      }
      sales.current.clear()
      setSubmitted(true)
    } catch {
      toast.error('Connexion perdue pendant la soumission. Vos notes restent en brouillon : réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  const deconnexion = async () => {
    const courant = affectations[currentIndex]
    if (courant && sales.current.has(courant.evalueId)) await sauvegarder(courant.evalueId)
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  /* ─── Filtrage de la liste ─── */

  const listeFiltree = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return affectations.filter((a) => {
      if (q && !`${a.evalue.prenom} ${a.evalue.nom} ${a.evalue.matricule} ${a.evalue.service ?? ''}`.toLowerCase().includes(q)) return false
      const fini = a.statut === 'TERMINEE' || estComplet(a)
      return filtre === 'tous' || (filtre === 'termines' ? fini : !fini)
    })
  }, [affectations, recherche, filtre, estComplet])

  /* ─── Rendus d'état ─── */

  if (loading) return <EcranChargement />

  if (erreur) {
    return (
      <EcranMessage
        titre="Notation indisponible"
        icone={<AlertCircle className="h-6 w-6 text-red-600" />}
        actions={
          <>
            {evaluateur?.role === 'ADMIN' && (
              <button onClick={() => router.push('/admin')} className={BTN_PRIMAIRE}>
                Ouvrir l’administration
              </button>
            )}
            <button onClick={recharger} className={BTN_SECONDAIRE}>
              Réessayer
            </button>
            <button onClick={deconnexion} className={BTN_DISCRET}>
              Se déconnecter
            </button>
          </>
        }
      >
        {erreur}
      </EcranMessage>
    )
  }

  if (submitted) {
    return (
      <EcranMessage
        titre="Évaluations transmises"
        icone={<CircleCheck className="h-6 w-6 text-emerald-600" />}
        actions={
          <button onClick={deconnexion} className={BTN_PRIMAIRE}>
            <LogOut className="h-4 w-4" aria-hidden />
            Se déconnecter
          </button>
        }
      >
        Merci {evaluateur?.prenom}. Vos notes pour les {affectations.length} collaborateurs de la campagne{' '}
        <strong className="font-medium text-slate-900">{campagne?.libelle}</strong> ont été transmises et sont désormais verrouillées.
      </EcranMessage>
    )
  }

  const courant = affectations[currentIndex]
  const criteresCourants = criteresDe(courant)
  const verrouille = courant?.statut === 'TERMINEE' || lectureSeule
  const pct = affectations.length ? Math.round((nbComplets / affectations.length) * 100) : 0

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      {/* ─── En-tête ─── */}
      <header className="relative z-30 flex h-[68px] shrink-0 items-center gap-3 overflow-hidden bg-navy-900 px-3 text-white sm:px-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_160%_at_0%_0%,#0b3d63_0%,transparent_65%)]" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

        <button
          onClick={() => setTiroir(true)}
          className="relative rounded-md p-2 text-navy-100 hover:bg-white/10 lg:hidden"
          aria-label="Afficher la liste des collaborateurs"
        >
          <Users className="h-5 w-5" />
        </button>
        <span className="relative rounded-[9px] shadow-[0_6px_16px_-6px_rgb(212_175_55/0.55)]">
          <BrandMark size={34} />
        </span>
        <div className="relative min-w-0 flex-1 leading-tight">
          <p className="truncate font-display text-[17px] font-medium tracking-[-0.01em]">{campagne && libelleCampagne(campagne.libelle)}</p>
          <p className="mt-0.5 hidden truncate text-xs text-navy-200 sm:block">
            {isManager ? 'Évaluation manager' : 'Évaluation entre collègues'} · jusqu’au{' '}
            {campagne && new Date(campagne.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="relative hidden w-52 md:block" aria-label={`Progression : ${nbComplets} sur ${affectations.length} collaborateurs`}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-navy-200">Progression</span>
            <span className="font-display text-sm font-medium tabular-nums">
              {nbComplets} <span className="text-navy-300">/ {affectations.length}</span>
            </span>
          </div>
          <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-200 shadow-[0_0_10px_rgb(212_175_55/0.55)] transition-[width] duration-700 ease-[var(--ease-out-expo)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="relative">
          <IndicateurSauvegarde etat={sauvegarde} />
        </div>

        <button
          onClick={soumettre}
          disabled={submitting || lectureSeule || ouvertes.length === 0}
          className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-4 ${
            pret
              ? 'bg-gradient-to-b from-gold-300 to-gold-500 text-navy-950 shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_8px_20px_-8px_rgb(212_175_55/0.7)] hover:-translate-y-px'
              : 'bg-white/[0.07] text-navy-100 ring-1 ring-white/15 hover:bg-white/[0.12]'
          } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0`}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          <span className="hidden sm:inline">Soumettre</span>
        </button>

        <button onClick={deconnexion} className="relative rounded-md p-2 text-navy-200 hover:bg-white/10 hover:text-white" aria-label="Se déconnecter" title="Se déconnecter">
          <LogOut className="h-4.5 w-4.5" />
        </button>
      </header>

      {campagne?.messagePeriode && (
        <p className="flex items-center justify-center gap-2 bg-gold-100 px-4 py-2 text-sm text-gold-900">
          <Lock className="h-4 w-4" aria-hidden />
          {campagne.messagePeriode} Vos notes sont consultables mais ne peuvent plus être modifiées.
        </p>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/* ─── Liste des collaborateurs ─── */}
        {tiroir && <div className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={() => setTiroir(false)} aria-hidden />}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[19rem] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
            tiroir ? 'translate-x-0 shadow-overlay' : '-translate-x-full'
          }`}
          aria-label="Collaborateurs à évaluer"
        >
          <div className="space-y-3.5 border-b border-slate-100 p-4 pt-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-baseline gap-2 font-display text-lg font-medium text-navy-900">
                Vos collaborateurs
                <span className="font-sans text-xs font-medium text-slate-400 tabular-nums">{affectations.length}</span>
              </h2>
              <button onClick={() => setTiroir(false)} className="rounded p-1 text-slate-400 hover:text-slate-700 lg:hidden" aria-label="Fermer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <label className="relative block">
              <span className="sr-only">Rechercher un collaborateur</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom, matricule, service…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-3 pl-9 text-sm shadow-[inset_0_1px_2px_rgb(0_43_73/0.04)] outline-none transition placeholder:text-slate-400 focus:border-navy-600 focus:bg-white focus:ring-4 focus:ring-navy-600/10"
              />
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-navy-50 p-1 text-xs ring-1 ring-navy-100" role="tablist" aria-label="Filtrer">
              {([
                ['tous', `Tous`],
                ['a_faire', `À faire`],
                ['termines', `Faits`],
              ] as const).map(([k, l]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={filtre === k}
                  onClick={() => setFiltre(k)}
                  className={`rounded-lg py-1.5 transition-all duration-200 ${
                    filtre === k
                      ? 'bg-white font-semibold text-navy-900 shadow-[0_1px_2px_rgb(0_43_73/0.08),0_4px_10px_-4px_rgb(0_43_73/0.18)]'
                      : 'text-navy-500 hover:text-navy-900'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <ol className="flex-1 space-y-1 overflow-y-auto p-2.5">
            {listeFiltree.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">Aucun collaborateur ne correspond.</li>}
            {listeFiltree.map((aff) => {
              const idx = affectations.indexOf(aff)
              const actif = idx === currentIndex
              const fini = aff.statut === 'TERMINEE' || estComplet(aff)
              const ouvert = estDeverrouille(idx)
              const cs = criteresDe(aff)
              const remplis = cs.filter((c) => valeur(aff.evalueId, c.id) > 0).length
              return (
                <li key={aff.id}>
                  <button
                    onClick={() => allerA(idx)}
                    disabled={!ouvert}
                    aria-current={actif ? 'step' : undefined}
                    title={!ouvert ? 'Terminez d’abord les collaborateurs précédents' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                      actif
                        ? 'bg-white shadow-[0_1px_2px_rgb(0_43_73/0.06),0_6px_16px_-8px_rgb(0_43_73/0.25)] ring-1 ring-navy-200'
                        : ouvert
                          ? 'hover:bg-slate-50'
                          : 'cursor-not-allowed opacity-45'
                    }`}
                  >
                    <span
                      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        actif
                          ? 'bg-gradient-to-b from-navy-700 to-navy-950 text-white ring-2 ring-gold-400/80 ring-offset-2'
                          : fini
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {initiales(aff)}
                      {(fini || !ouvert) && (
                        <span
                          className={`absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${
                            fini ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white'
                          }`}
                        >
                          {fini ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <Lock className="h-2.5 w-2.5" />}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${actif ? 'font-semibold text-navy-900' : 'font-medium text-slate-800'}`}>{nomComplet(aff)}</span>
                      <span className="block truncate text-xs text-slate-500">{aff.evalue.service || 'Service non renseigné'}</span>
                      {/* Avancement des critères de ce collaborateur */}
                      <span aria-hidden className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={`block h-full rounded-full transition-[width] duration-500 ${fini ? 'bg-emerald-500' : 'bg-gold-500'}`}
                          style={{ width: `${cs.length ? (aff.statut === 'TERMINEE' ? 100 : (remplis / cs.length) * 100) : 0}%` }}
                        />
                      </span>
                    </span>
                    <span className={`shrink-0 text-xs tabular-nums ${fini ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {aff.statut === 'TERMINEE' ? 'Soumis' : `${remplis}/${cs.length}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            {nbComplets} sur {affectations.length} terminés · ordre alphabétique
          </p>
        </aside>

        {/* ─── Zone de notation ─── */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#e9eef4_0%,var(--color-canvas)_340px)]">
          {courant && (
            <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
              <EnteteCollaborateur
                aff={courant}
                position={currentIndex + 1}
                total={affectations.length}
                criteres={criteresCourants}
                notes={notes[courant.evalueId] ?? {}}
              />

              <div className="flex items-center justify-between gap-3">
                {/* Parcours des critères : étapes reliées, notées en or */}
                <nav className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1" aria-label="Critères">
                  <ol className="flex items-center">
                    {criteresCourants.map((c, i) => {
                      const v = valeur(courant.evalueId, c.id)
                      const ouvert = i === 0 || criteresCourants.slice(0, i).every((p) => valeur(courant.evalueId, p.id) > 0)
                      const actif = vue === 'focus' && i === critereIndex
                      return (
                        <li key={c.id} className="flex shrink-0 items-center">
                          {i > 0 && (
                            <span
                              aria-hidden
                              className={`mx-1 h-px w-3 xl:w-5 ${valeur(courant.evalueId, criteresCourants[i - 1].id) > 0 ? 'bg-gold-400' : 'bg-slate-300'}`}
                            />
                          )}
                          <button
                            onClick={() => {
                              setVue('focus')
                              setCritereIndex(i)
                            }}
                            disabled={!ouvert}
                            aria-current={actif ? 'step' : undefined}
                            aria-label={`Critère ${i + 1} : ${c.libelle}${v > 0 ? ' (noté)' : ''}`}
                            title={c.libelle}
                            className={`group flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs transition-all duration-200 ${
                              actif
                                ? 'bg-navy-900 font-semibold text-white shadow-[0_6px_14px_-6px_rgb(0_26_46/0.6)]'
                                : v > 0
                                  ? 'text-navy-900 hover:bg-white'
                                  : ouvert
                                    ? 'text-slate-600 hover:bg-white'
                                    : 'cursor-not-allowed text-slate-400'
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors ${
                                actif
                                  ? v > 0
                                    ? 'bg-gold-400 text-navy-950'
                                    : 'bg-white/15 text-white'
                                  : v > 0
                                    ? 'bg-gold-100 text-gold-800 ring-1 ring-gold-300'
                                    : ouvert
                                      ? 'bg-white text-slate-600 ring-1 ring-slate-300'
                                      : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {v > 0 ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : i + 1}
                            </span>
                            {/* Sur écran moyen, seuls le critère en cours et les critères notés gardent leur nom */}
                            <span className={actif || v > 0 ? '' : 'hidden xl:inline'}>{c.libelle}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </nav>
                <button
                  onClick={() => setVue(vue === 'focus' ? 'liste' : 'focus')}
                  className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-white/60 px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-white hover:text-navy-900 sm:inline-flex"
                >
                  {vue === 'focus' ? <LayoutList className="h-3.5 w-3.5" aria-hidden /> : <Rows3 className="h-3.5 w-3.5" aria-hidden />}
                  {vue === 'focus' ? 'Tout afficher' : 'Un critère à la fois'}
                </button>
              </div>

              {vue === 'focus' && criteresCourants[critereIndex] ? (
                <CarteCritere
                  key={`${courant.evalueId}-${criteresCourants[critereIndex].id}`}
                  aff={courant}
                  critere={criteresCourants[critereIndex]}
                  position={critereIndex + 1}
                  total={criteresCourants.length}
                  note={notes[courant.evalueId]?.[criteresCourants[critereIndex].id]}
                  verrouille={verrouille}
                  onNote={(n) => choisirNote(courant, criteresCourants[critereIndex], n)}
                  onCommentaire={(t) => changerCommentaire(courant, criteresCourants[critereIndex].id, t)}
                  autoFocus
                />
              ) : (
                <div className="space-y-4">
                  {criteresCourants.map((c, i) => (
                    <CarteCritere
                      key={`${courant.evalueId}-${c.id}`}
                      aff={courant}
                      critere={c}
                      position={i + 1}
                      total={criteresCourants.length}
                      note={notes[courant.evalueId]?.[c.id]}
                      verrouille={verrouille}
                      onNote={(n) => choisirNote(courant, c, n)}
                      onCommentaire={(t) => changerCommentaire(courant, c.id, t)}
                      compact
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <button
                  onClick={() => (vue === 'focus' && critereIndex > 0 ? setCritereIndex(critereIndex - 1) : allerA(currentIndex - 1))}
                  disabled={(vue === 'liste' || critereIndex === 0) && currentIndex === 0}
                  className={BTN_SECONDAIRE}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Précédent
                </button>
                <ActionSuivante
                  vue={vue}
                  critereIndex={critereIndex}
                  nbCriteres={criteresCourants.length}
                  critereNote={valeur(courant.evalueId, criteresCourants[critereIndex]?.id ?? '') > 0}
                  collaborateurComplet={courant.statut === 'TERMINEE' || estComplet(courant)}
                  dernier={currentIndex === affectations.length - 1}
                  pret={pret}
                  submitting={submitting}
                  onCritereSuivant={() => setCritereIndex(critereIndex + 1)}
                  onCollaborateurSuivant={() => allerA(currentIndex + 1)}
                  onSoumettre={soumettre}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

/* ─── Sous-composants ───────────────────────────────────────────── */

const BTN_PRIMAIRE =
  'group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-navy-800 to-navy-950 px-5 py-3 text-sm font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_10px_20px_-10px_rgb(0_26_46/0.7)] transition-[box-shadow,transform,opacity] duration-200 hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_16px_28px_-12px_rgb(0_26_46/0.75)] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none'
const BTN_SECONDAIRE =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgb(0_43_73/0.05)] ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-40'
const BTN_DISCRET = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100'

function EnteteCollaborateur({
  aff,
  position,
  total,
  criteres,
  notes,
}: {
  aff: Affectation
  position: number
  total: number
  criteres: Critere[]
  notes: Record<string, NoteState>
}) {
  const somme = criteres.reduce((s, c) => s + (notes[c.id]?.valeur ?? 0), 0)
  const max = criteres.reduce((s, c) => s + c.noteMaximale, 0)
  const notes_ = criteres.filter((c) => (notes[c.id]?.valeur ?? 0) > 0).length
  // Appréciation calculée sur les seuls critères déjà notés
  const maxNotes = criteres.reduce((s, c) => s + ((notes[c.id]?.valeur ?? 0) > 0 ? c.noteMaximale : 0), 0)
  const appreciation = maxNotes > 0 ? getAppreciationInfo((somme / maxNotes) * 100) : null

  return (
    <section className="relative flex animate-entree flex-col gap-5 overflow-hidden rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgb(0_43_73/0.05),0_12px_32px_-16px_rgb(0_43_73/0.22)] sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-navy-700 to-navy-950 font-display text-lg font-medium text-white ring-2 ring-gold-400/80 ring-offset-[3px]">
          {initiales(aff)}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            Collaborateur <span className="font-semibold text-navy-900 tabular-nums">{position}</span> sur {total}
          </p>
          <h1 className="mt-0.5 truncate font-display text-[1.45rem] leading-tight font-medium tracking-[-0.01em] text-navy-900 sm:text-[1.75rem]">
            {nomComplet(aff)}
          </h1>
          <p className="mt-1 truncate text-sm text-slate-600">
            {aff.evalue.service || 'Service non renseigné'}
            {aff.evalue.emploi && <> · {aff.evalue.emploi}</>}
            <span className="text-slate-400"> · {aff.evalue.matricule}</span>
          </p>
        </div>
      </div>
      <div className="shrink-0 sm:min-w-[11rem] sm:text-right" aria-live="polite">
        <p className="font-display text-[2rem] leading-none font-medium text-navy-900 tabular-nums">
          {somme}
          <span className="font-sans text-sm font-normal text-slate-500"> / {max} pts</span>
        </p>
        {/* Un segment par critère : or quand il est noté */}
        <div className="mt-3 flex gap-1 sm:justify-end" aria-hidden>
          {criteres.map((c) => (
            <span
              key={c.id}
              className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${(notes[c.id]?.valeur ?? 0) > 0 ? 'bg-gold-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {notes_} critère{notes_ > 1 ? 's' : ''} noté{notes_ > 1 ? 's' : ''} sur {criteres.length}
          {appreciation && (
            <>
              {' · '}
              <span className="font-semibold text-navy-900">{appreciation.appreciation}</span>
            </>
          )}
        </p>
      </div>
    </section>
  )
}

function CarteCritere({
  aff,
  critere,
  position,
  total,
  note,
  verrouille,
  onNote,
  onCommentaire,
  compact = false,
  autoFocus = false,
}: {
  aff: Affectation
  critere: Critere
  position: number
  total: number
  note?: NoteState
  verrouille: boolean
  onNote: (n: number) => void
  onCommentaire: (t: string) => void
  compact?: boolean
  autoFocus?: boolean
}) {
  const options = getAppreciationOptions(critere.noteMaximale)
  const v = note?.valeur ?? 0
  const commentaire = note?.commentaire ?? ''
  const nom = `note-${aff.evalueId}-${critere.id}`
  const premierRadio = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && !verrouille) premierRadio.current?.focus({ preventScroll: true })
  }, [autoFocus, verrouille])

  return (
    <section
      className={`rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_43_73/0.05),0_12px_32px_-18px_rgb(0_43_73/0.22)] ${
        compact ? 'p-5 sm:p-6' : 'animate-entree p-5 sm:p-9'
      }`}
    >
      <fieldset disabled={verrouille}>
        <legend className="contents">
          <span className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className={`block font-display font-medium tracking-[-0.015em] text-navy-900 ${compact ? 'text-xl' : 'text-[1.75rem] sm:text-[2.1rem]'} leading-tight`}>
              {critere.libelle}
            </span>
            <span className="shrink-0 text-xs text-slate-500">
              Critère <span className="font-semibold text-navy-900 tabular-nums">{position}</span> sur {total} · noté sur {critere.noteMaximale}
            </span>
          </span>
        </legend>
        {!compact && <span aria-hidden className="mt-4 block h-px w-14 bg-gradient-to-r from-gold-500 to-gold-500/20" />}
        {critere.description && !compact && <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-slate-600">{critere.description}</p>}

        <div
          className={`grid gap-2.5 ${compact ? 'mt-4' : 'mt-7'} ${critere.noteMaximale === 10 ? 'grid-cols-2 sm:grid-cols-5' : compact ? 'grid-cols-5' : 'grid-cols-1 md:grid-cols-5'}`}
          role="radiogroup"
          aria-label={`Appréciation pour ${critere.libelle}`}
        >
          {options.map((opt, i) => {
            const choisi = v === opt.note
            // Niveau visuel de l'appréciation, sur 5 crans quel que soit le barème
            const crans = Math.max(1, Math.round((opt.note / critere.noteMaximale) * 5))
            return (
              <label
                key={opt.note}
                className={`group relative flex cursor-pointer rounded-xl ring-1 transition-[background-color,box-shadow,color,transform] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy-600 has-[:disabled]:cursor-not-allowed ${
                  choisi
                    ? 'bg-gradient-to-b from-navy-800 to-navy-950 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_14px_28px_-14px_rgb(0_26_46/0.8)] ring-navy-900'
                    : 'bg-white text-slate-800 ring-slate-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-14px_rgb(0_43_73/0.45)] hover:ring-navy-300 has-[:disabled]:hover:translate-y-0 has-[:disabled]:hover:shadow-none'
                } ${compact ? 'flex-col items-center p-3 text-center' : 'items-center gap-4 p-4 md:flex-col md:items-start md:gap-0'}`}
              >
                <input
                  ref={i === 0 ? premierRadio : undefined}
                  type="radio"
                  name={nom}
                  value={opt.note}
                  checked={choisi}
                  onChange={() => onNote(opt.note)}
                  className="sr-only"
                />
                {choisi && (
                  <span
                    aria-hidden
                    className={`absolute flex items-center justify-center rounded-full bg-gold-400 text-navy-950 ${compact ? 'top-1.5 right-1.5 h-4 w-4' : 'top-3 right-3 h-5 w-5'}`}
                  >
                    <Check className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={3} />
                  </span>
                )}
                <span
                  className={`shrink-0 font-display leading-none font-medium tabular-nums transition-colors ${compact ? 'text-xl' : 'text-[2rem]'} ${
                    choisi ? 'text-gold-300' : 'text-navy-900 group-hover:text-navy-700'
                  }`}
                >
                  {opt.note}
                </span>
                <span className={`min-w-0 ${compact ? 'mt-1' : 'md:mt-3'}`}>
                  <span className={`block font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>{opt.appreciation}</span>
                  {!compact && <span className={`mt-1 block text-xs leading-snug ${choisi ? 'text-navy-200' : 'text-slate-500'}`}>{opt.description}</span>}
                </span>
                {!compact && (
                  <span aria-hidden className="ml-auto flex shrink-0 gap-[3px] md:mt-auto md:ml-0 md:w-full md:pt-4">
                    {Array.from({ length: 5 }, (_, k) => (
                      <span
                        key={k}
                        className={`h-1 w-3 rounded-full md:w-auto md:flex-1 ${
                          k < crans ? (choisi ? 'bg-gold-400' : 'bg-navy-300 group-hover:bg-navy-500') : choisi ? 'bg-white/15' : 'bg-slate-100'
                        }`}
                      />
                    ))}
                  </span>
                )}
              </label>
            )
          })}
        </div>

        <div className={compact ? 'mt-4' : 'mt-7'}>
          <label htmlFor={`com-${nom}`} className="flex items-baseline justify-between text-sm font-medium text-slate-800">
            Commentaire <span className="text-xs font-normal text-slate-400">facultatif</span>
          </label>
          <textarea
            id={`com-${nom}`}
            rows={compact ? 2 : 3}
            value={commentaire}
            maxLength={MAX_COMMENTAIRE}
            disabled={verrouille || v === 0}
            onChange={(e) => onCommentaire(e.target.value)}
            placeholder={v === 0 ? 'Choisissez d’abord une appréciation.' : 'Un fait marquant, un exemple concret, une piste de progrès…'}
            className="mt-2 block w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-[15px] text-slate-900 shadow-[inset_0_1px_2px_rgb(0_43_73/0.04)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-navy-600 focus:bg-white focus:ring-4 focus:ring-navy-600/10 disabled:cursor-not-allowed disabled:hover:border-slate-200"
          />
          {commentaire.length > MAX_COMMENTAIRE - 80 && (
            <p className="mt-1 text-right text-xs text-slate-500 tabular-nums">
              {commentaire.length} / {MAX_COMMENTAIRE}
            </p>
          )}
        </div>
      </fieldset>
    </section>
  )
}

function ActionSuivante(p: {
  vue: 'focus' | 'liste'
  critereIndex: number
  nbCriteres: number
  critereNote: boolean
  collaborateurComplet: boolean
  dernier: boolean
  pret: boolean
  submitting: boolean
  onCritereSuivant: () => void
  onCollaborateurSuivant: () => void
  onSoumettre: () => void
}) {
  if (p.vue === 'focus' && p.critereIndex < p.nbCriteres - 1) {
    return (
      <button onClick={p.onCritereSuivant} disabled={!p.critereNote} className={BTN_PRIMAIRE}>
        Critère suivant
        <ChevronRight className="h-4 w-4 text-gold-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </button>
    )
  }
  if (!p.dernier) {
    return (
      <button onClick={p.onCollaborateurSuivant} disabled={!p.collaborateurComplet} className={BTN_PRIMAIRE}>
        Collaborateur suivant
        <ChevronRight className="h-4 w-4 text-gold-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </button>
    )
  }
  return (
    <button
      onClick={p.onSoumettre}
      disabled={!p.pret || p.submitting}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-3 text-sm font-semibold text-navy-950 shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_10px_22px_-10px_rgb(212_175_55/0.75)] transition-[transform,opacity] duration-200 hover:-translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Send className="h-4 w-4" aria-hidden />
      Soumettre mes évaluations
    </button>
  )
}

function IndicateurSauvegarde({ etat }: { etat: Sauvegarde }) {
  const contenu = {
    idle: null,
    pending: <span className="text-navy-200">Modifications en cours…</span>,
    saving: (
      <span className="flex items-center gap-1.5 text-navy-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Enregistrement…
      </span>
    ),
    saved: (
      <span className="flex items-center gap-1.5 text-navy-100">
        <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
        Brouillon enregistré{etat.at && ` à ${etat.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
      </span>
    ),
    error: (
      <span className="flex items-center gap-1.5 text-red-200">
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        Non enregistré
      </span>
    ),
  }[etat.etat]
  return (
    <p className="hidden text-xs whitespace-nowrap lg:block" role="status" aria-live="polite">
      {contenu}
    </p>
  )
}

function EcranChargement() {
  return (
    <div className="flex h-dvh flex-col bg-canvas" aria-busy="true" aria-label="Chargement de vos évaluations">
      <div className="h-16 bg-navy-900" />
      <div className="flex flex-1">
        <div className="hidden w-[19rem] space-y-3 border-r border-slate-200 bg-white p-4 lg:block">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="mx-auto w-full max-w-5xl space-y-5 p-8">
          <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-white" />
          <div className="h-80 animate-pulse rounded-[var(--radius-card)] bg-white" />
        </div>
      </div>
    </div>
  )
}

function EcranMessage({
  titre,
  icone,
  children,
  actions,
}: {
  titre: string
  icone: React.ReactNode
  children: React.ReactNode
  actions: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 items-center gap-3 bg-navy-900 px-6 text-white">
        <BrandMark size={32} />
        <span className="text-[15px] font-semibold">
          DSM <span className="text-gold-500">TAMIS</span>
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="relative w-full max-w-md animate-entree overflow-hidden rounded-2xl bg-white p-9 shadow-[0_1px_2px_rgb(0_43_73/0.05),0_16px_40px_-18px_rgb(0_43_73/0.3)]">
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50">{icone}</span>
          <h1 className="mt-5 font-display text-2xl font-medium tracking-[-0.01em] text-navy-900">{titre}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{children}</p>
          <div className="mt-7 flex flex-wrap gap-2">{actions}</div>
        </div>
      </main>
    </div>
  )
}
