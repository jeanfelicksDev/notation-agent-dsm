'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  ChevronRight,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Award,
  LogOut,
  Save,
  Send,
  ChevronLeft,
  Check,
  Star,
  ShieldAlert,
  X,
} from 'lucide-react'
import { getAppreciationOptions } from '@/lib/default-criteres'

interface Critere {
  id: string
  libelle: string
  description: string | null
  noteMaximale: number
  typeEvaluateur: string
}

interface Affectation {
  id: string
  evalueId: string
  statut: 'EN_ATTENTE' | 'BROUILLON' | 'TERMINEE'
  evalue: {
    id: string
    matricule: string
    nom: string
    prenom: string
    service: string | null
    site: { nom: string } | null
  }
}

interface Evaluateur {
  id: string
  matricule: string
  nom: string
  prenom: string
  service: string | null
  email: string
  role: string
  site: { nom: string } | null
}

interface Campagne {
  id: string
  libelle: string
  poidsCollegues: number
  poidsManager: number
}

type NoteState = { valeur: number; commentaire: string }
type NotesMap = Record<string, Record<string, NoteState>>

export default function EvaluerPage() {
  const router = useRouter()

  const [evaluateur, setEvaluateur] = useState<Evaluateur | null>(null)
  const [campagne, setCampagne] = useState<Campagne | null>(null)
  const [criteres, setCriteres] = useState<Critere[]>([])
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [isManager, setIsManager] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentCritereIndex, setCurrentCritereIndex] = useState(0)
  const [notes, setNotes] = useState<NotesMap>({})
  const [transitionToast, setTransitionToast] = useState<{
    prevNom: string
    nextNom?: string
    isFinal?: boolean
  } | null>(null)

  useEffect(() => {
    setCurrentCritereIndex(0)
  }, [currentIndex])

  useEffect(() => {
    if (!transitionToast) return
    const t = setTimeout(() => setTransitionToast(null), 4500)
    return () => clearTimeout(t)
  }, [transitionToast])
  const [loading, setLoading] = useState(true)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3500)
    return () => clearTimeout(t)
  }, [feedback])

  const loadData = async () => {
    setLoading(true)
    setError('')
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
      if (!res.ok) {
        setError(data.error || 'Erreur de chargement')
        return
      }
      if (data.evaluateur) {
        setEvaluateur(data.evaluateur)
      }
      setCampagne(data.campagne)
      setCriteres(data.criteres)
      // Règle stricte : exclusion totale de toute auto-évaluation
      const evalId = data.evaluateur?.id
      const evalMatricule = data.evaluateur?.matricule
      const safeAffectations = (data.affectations || []).filter((a: Affectation) => {
        if (evalId && a.evalueId === evalId) return false
        if (evalMatricule && a.evalue?.matricule === evalMatricule) return false
        return true
      })

      const sorted = safeAffectations.sort((a: Affectation, b: Affectation) => {
        const nomA = (a.evalue.nom || '').trim().toUpperCase()
        const nomB = (b.evalue.nom || '').trim().toUpperCase()
        if (nomA !== nomB) return nomA.localeCompare(nomB, 'fr')

        const prenomA = (a.evalue.prenom || '').trim().toUpperCase()
        const prenomB = (b.evalue.prenom || '').trim().toUpperCase()
        return prenomA.localeCompare(prenomB, 'fr')
      })
      setAffectations(sorted)
      setIsManager(Boolean(data.isManager))

      if (Array.isArray(data.notes)) {
        const loaded: NotesMap = {}
        for (const n of data.notes) {
          if (!loaded[n.evalueId]) loaded[n.evalueId] = {}
          loaded[n.evalueId][n.critereId] = {
            valeur: n.valeur,
            commentaire: n.commentaire || '',
          }
        }
        setNotes(loaded)
      }

      if (
        data.affectations.length > 0 &&
        data.affectations.every((a: Affectation) => a.statut === 'TERMINEE')
      ) {
        setSubmitted(true)
      }
    } catch {
      setError('Erreur réseau lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  const navigateToCollaborator = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= affectations.length || targetIdx === currentIndex) return
    const current = affectations[currentIndex]
    const target = affectations[targetIdx]

    if (current && target) {
      const isCompleted =
        criteres.length > 0 &&
        criteres.every((c) => (notes[current.evalueId]?.[c.id]?.valeur || 0) > 0)
      if (isCompleted) {
        setTransitionToast({
          prevNom: `${current.evalue.prenom} ${current.evalue.nom}`,
          nextNom: `${target.evalue.prenom} ${target.evalue.nom}`,
          isFinal: false,
        })
      }
    }
    handleSave()
    setCurrentIndex(targetIdx)
    setCurrentCritereIndex(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNoteChange = (evalueId: string, critereId: string, valeur: number) => {
    setNotes((prev) => {
      const updated = {
        ...prev,
        [evalueId]: {
          ...prev[evalueId],
          [critereId]: {
            valeur,
            commentaire: prev[evalueId]?.[critereId]?.commentaire || '',
          },
        },
      }

      // Détecter si on vient de terminer le dernier critère du dernier collaborateur
      const isLastCollaborator = currentIndex === affectations.length - 1
      const isLastCritere = currentCritereIndex === criteres.length - 1
      if (isLastCollaborator && isLastCritere) {
        const currentAff = affectations[currentIndex]
        const allThisAffDone = criteres.every(
          (c) => (c.id === critereId ? valeur > 0 : (updated[evalueId]?.[c.id]?.valeur || 0) > 0)
        )
        const allOthersDone = affectations.every(
          (a) =>
            a.evalueId === evalueId ||
            criteres.every((c) => (updated[a.evalueId]?.[c.id]?.valeur || 0) > 0)
        )
        if (allThisAffDone && allOthersDone) {
          setTransitionToast({
            prevNom: `${currentAff.evalue.prenom} ${currentAff.evalue.nom}`,
            isFinal: true,
          })
        }
      }
      return updated
    })
  }

  const handleCommentaireChange = (
    evalueId: string,
    critereId: string,
    commentaire: string
  ) => {
    setNotes((prev) => ({
      ...prev,
      [evalueId]: {
        ...prev[evalueId],
        [critereId]: {
          valeur: prev[evalueId]?.[critereId]?.valeur ?? 0,
          commentaire,
        },
      },
    }))
  }

  const handleSave = async () => {
    const current = affectations[currentIndex]
    if (!current) return
    const evalueNotes = notes[current.evalueId] || {}
    const notesToSave = Object.entries(evalueNotes)
      .filter(([, n]) => n.valeur > 0)
      .map(([critereId, n]) => ({
        critereId,
        valeur: n.valeur,
        commentaire: n.commentaire,
      }))

    if (notesToSave.length === 0) {
      setFeedback({ type: 'error', msg: 'Renseignez au moins une note avant de sauvegarder' })
      return
    }

    setSavingDraft(true)
    try {
      const res = await fetch('/api/evaluation/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evalueId: current.evalueId, notes: notesToSave }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({ type: 'success', msg: 'Brouillon enregistré' })
        setAffectations((prev) =>
          prev.map((a) =>
            a.evalueId === current.evalueId && a.statut === 'EN_ATTENTE'
              ? { ...a, statut: 'BROUILLON' }
              : a
          )
        )
      } else {
        setFeedback({ type: 'error', msg: data.error || 'Échec de la sauvegarde' })
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Erreur réseau' })
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSubmitAll = () => {
    // Toutes les notes doivent être > 0 pour tous les critères de tous les évalués
    for (const aff of affectations) {
      for (const crit of criteres) {
        const val = notes[aff.evalueId]?.[crit.id]?.valeur || 0
        if (val === 0) {
          const idx = affectations.findIndex((a) => a.id === aff.id)
          const errMsg = `Le critère "${crit.libelle}" est manquant pour ${aff.evalue.prenom} ${aff.evalue.nom}`
          setCurrentIndex(idx)
          setFeedback({
            type: 'error',
            msg: errMsg,
          })
          setValidationError(errMsg)
          window.scrollTo({ top: 0, behavior: 'smooth' })
          return
        }
      }
    }

    // Tout est rempli → afficher le modal de confirmation
    setValidationError(null)
    setShowConfirmModal(true)
  }

  const executeSubmit = async () => {
    setShowConfirmModal(false)
    setSubmitting(true)
    try {
      const activeEvalueIds = new Set(affectations.map((a) => a.evalueId))
      const allNotes = Object.entries(notes)
        .filter(([evalueId]) => activeEvalueIds.has(evalueId))
        .flatMap(([evalueId, evalueNotes]) =>
          Object.entries(evalueNotes).map(([critereId, n]) => ({
            evalueId,
            critereId,
            valeur: n.valeur,
            commentaire: n.commentaire,
          }))
        )
      const res = await fetch('/api/evaluation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: allNotes }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSubmitted(true)
      } else {
        let userMsg = data.error || 'Échec de la soumission'
        if (res.status === 409) {
          userMsg = 'Ces évaluations ont déjà été soumises et verrouillées. Rechargez la page.'
        } else if (res.status === 403) {
          userMsg = 'Accès refusé : certaines évaluations ne vous sont pas affectées ou l\'auto-évaluation a été détectée.'
        } else if (res.status === 401) {
          window.location.href = '/?reason=session_expired'
          return
        } else if (res.status >= 500) {
          userMsg = 'Erreur serveur inattendue. Veuillez réessayer dans quelques instants.' + (data.error ? ` (${data.error})` : '')
        }
        setFeedback({ type: 'error', msg: userMsg })
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Erreur réseau' })
    } finally {
      setSubmitting(false)
    }
  }

  const completionCount = useMemo(() => {
    let done = 0
    for (const aff of affectations) {
      const all = criteres.every((c) => (notes[aff.evalueId]?.[c.id]?.valeur || 0) > 0)
      if (all && criteres.length > 0) done++
    }
    return done
  }, [affectations, criteres, notes])

  const currentEvalue = affectations[currentIndex]
  const currentScoreSubtotal = useMemo(() => {
    if (!currentEvalue) return 0
    return criteres.reduce(
      (sum, c) => sum + (notes[currentEvalue.evalueId]?.[c.id]?.valeur || 0),
      0
    )
  }, [criteres, notes, currentEvalue])

  const maxSubtotal = useMemo(
    () => criteres.reduce((sum, c) => sum + c.noteMaximale, 0),
    [criteres]
  )

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #00182f 0%, #002d50 100%)', fontFamily: 'var(--font-outfit), sans-serif' }}>
        <div className="bg-white rounded-3xl shadow-2xl p-10 sm:p-14 text-center max-w-lg w-full animate-fade-in">
          {/* Animated success icon */}
          <div className="relative w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.08) 100%)' }}>
            <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: 'rgba(16,185,129,0.3)' }} />
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>

          <h2 className="text-3xl font-black mb-4" style={{ color: '#00182f', fontFamily: 'var(--font-outfit)' }}>
            Évaluations soumises avec succès
          </h2>
          <p className="text-base mb-3" style={{ color: '#5a6880', fontFamily: 'var(--font-inter)' }}>
            Merci ! Vos notes ont été enregistrées et <strong>définitivement verrouillées</strong>.
          </p>
          <p className="text-sm mb-2" style={{ color: '#5a6880', fontFamily: 'var(--font-inter)' }}>
            Il n'est plus possible de modifier ou d'accéder à ces évaluations.
          </p>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 mb-8 mt-6">
            <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm">
              <CheckCircle className="w-4 h-4" />
              {affectations.length} évaluation{affectations.length > 1 ? 's' : ''} clôturée{affectations.length > 1 ? 's' : ''}
            </div>
          </div>

          <p className="text-xs mb-8 font-mono tracking-wider" style={{ color: '#adb8c9' }}>
            DSM TAMIS • Direction des Solutions Maritimes
          </p>

          <button
            onClick={handleLogout}
            className="w-full px-6 py-4 bg-[#002B49] hover:bg-[#001829] text-white rounded-2xl font-bold text-base shadow-lg shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#f9f9f9', fontFamily: 'Inter, sans-serif' }}>
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: '#e2e8f0', borderTopColor: '#075fac' }} />
        <p className="text-sm font-medium" style={{ color: '#5a6880' }}>Chargement de votre session…</p>
      </div>
    )
  }

  if (error) {
    const isUserAdmin = evaluateur?.role === 'ADMIN'
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">
            Impossible de charger
          </h2>
          <p className="text-slate-600 text-center mb-6">{error}</p>

          {isUserAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full mb-4 bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-brand-200 transition-all flex items-center justify-center gap-2"
            >
              Accéder à l'Espace Administration
            </button>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl"
            >
              Se déconnecter
            </button>
            <button
              onClick={() => loadData()}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )
  }

  const progressPct =
    affectations.length === 0 ? 0 : Math.round((completionCount / affectations.length) * 100)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#002B49] border-b border-[#D4AF37]/40 shadow-lg text-[#D4AF37]">
        <div className="max-w-[1728px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[#D4AF37] rounded-xl flex items-center justify-center shadow-md shadow-[#D4AF37]/20 flex-shrink-0">
              <Award className="w-5 h-5 text-[#002B49]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-[#D4AF37] uppercase tracking-widest leading-none mb-1 opacity-90 flex items-center gap-1.5">
                <span>Session Notant :</span>
                <span className="font-mono text-[10px] bg-[#001829] text-[#D4AF37] px-2 py-0.5 rounded-md border border-[#D4AF37]/30">
                  {evaluateur?.matricule ? `#${evaluateur.matricule}` : 'N/A'}
                </span>
              </p>
              <p className="font-extrabold text-white text-base truncate">
                {evaluateur?.prenom} {evaluateur?.nom}
                {evaluateur?.service && (
                  <span className="font-semibold text-[#D4AF37]/80 ml-1.5 text-xs">· {evaluateur.service}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#002B49] bg-[#001d33] border border-[#D4AF37]/40 px-3.5 py-2 rounded-xl transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="max-w-[1728px] mx-auto px-4 sm:px-6 pb-3">
          <div className="flex items-center justify-between text-xs font-bold text-[#D4AF37] mb-1.5">
            <span>
              {completionCount} / {affectations.length} collègue
              {affectations.length > 1 ? 's' : ''} noté{completionCount > 1 ? 's' : ''}
            </span>
            {campagne && (
              <span className="text-[#D4AF37]/80 font-medium">
                Pondération : collègues {campagne.poidsCollegues} / manager {campagne.poidsManager}
              </span>
            )}
          </div>
          <div className="h-2 w-full bg-[#001829] rounded-full overflow-hidden border border-[#D4AF37]/30">
            <div
              className="h-full bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#F5E6AB] transition-all duration-500 shadow-sm"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Toast Transition Collaborateur */}
      {transitionToast && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-auto shadow-2xl rounded-2xl bg-white border-2 border-emerald-500/40 p-4 sm:p-5 text-slate-800 backdrop-blur-xl animate-fade-in ring-4 ring-emerald-500/10">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 text-white shadow-md shadow-emerald-500/30">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  {transitionToast.isFinal ? 'Toutes les notations terminées !' : 'Notation enregistrée'}
                </p>
              </div>
              <p className="text-sm font-bold text-slate-900 leading-snug">
                Évaluation de <span className="text-[#002B49] font-black underline decoration-emerald-400 decoration-2">{transitionToast.prevNom}</span> complétée avec succès !
              </p>
              {transitionToast.nextNom ? (
                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-100 text-xs font-semibold text-slate-600">
                  <span>Passage à :</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#002B49] text-white font-black text-xs shadow-sm flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                    {transitionToast.nextNom}
                  </span>
                  <ChevronRight className="w-4 h-4 text-emerald-600 ml-auto shrink-0" />
                </div>
              ) : transitionToast.isFinal ? (
                <p className="text-xs font-medium text-emerald-700 mt-1.5">
                  ✨ Tous les collaborateurs ont été évalués. Vous pouvez soumettre définitivement vos notes.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setTransitionToast(null)}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Fermer la notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="max-w-[1728px] mx-auto w-full px-4 sm:px-6 pt-3">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-600'
            }`}
          >
            {feedback.msg}
          </div>
        </div>
      )}

      <main className="max-w-[1728px] mx-auto px-4 sm:px-6 py-4 w-full flex-1">
        {/* Current colleague card */}
        {currentEvalue && (
          <>
            <div className="sm:sticky sm:top-[60px] sm:z-20 bg-slate-50/95 backdrop-blur-sm pt-1 pb-1 -mx-2 px-2">

            {/* Barre de Défilement / Sélection Directe des Agents à Noter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-2 dsm-horizontal-scrollbar scroll-smooth">
              {affectations.map((aff, idx) => {
                const isCompleted = criteres.every((c) => (notes[aff.evalueId]?.[c.id]?.valeur || 0) > 0)
                const isActive = idx === currentIndex
                const isUnlocked = idx === 0 || affectations.slice(0, idx).every(prevAff => criteres.every(c => (notes[prevAff.evalueId]?.[c.id]?.valeur || 0) > 0))
                return (
                  <button
                    key={aff.id}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => {
                      if (isUnlocked) navigateToCollaborator(idx)
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                      isActive
                        ? 'bg-[#002B49] text-white border-[#D4AF37] shadow-md shadow-[#002B49]/20 font-black'
                        : isCompleted
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : isUnlocked
                        ? 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        : 'bg-slate-100 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                      isActive ? 'bg-[#D4AF37] text-[#002B49]' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {idx + 1}
                    </span>
                    <span>{aff.evalue.prenom} {aff.evalue.nom}</span>
                    {isCompleted && (
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[8px] font-bold">✓</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Jauge Horizontale de Progression des Critères & Navigation par Puces (Même ligne que Critère X/Y) */}
            {criteres.length > 0 && (
              <div className="bg-[#002B49] rounded-2xl p-3 sm:p-4 border border-[#D4AF37]/30 shadow-md mb-3 space-y-2 animate-fade-in text-[#D4AF37]">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="px-2.5 py-1 bg-[#D4AF37] text-[#002B49] rounded-lg text-xs font-black shadow-sm shrink-0">
                    Critère {currentCritereIndex + 1} / {criteres.length}
                  </span>

                  {/* Boutons puces horizontaux centrés dans la zone bleue (colonne du milieu) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto sm:justify-center dsm-horizontal-scrollbar py-0.5 min-w-0">
                    {criteres.map((c, idx) => {
                        const isNoted = (notes[currentEvalue.evalueId]?.[c.id]?.valeur || 0) > 0
                        const isCurrent = idx === currentCritereIndex
                        // Règle chronologique stricte : le critère N est débloqué SEULEMENT si tous les critères 0..N-1 ont une note > 0
                        const isUnlocked = idx === 0 || criteres.slice(0, idx).every((prevC) => (notes[currentEvalue.evalueId]?.[prevC.id]?.valeur || 0) > 0)

                        return (
                          <button
                            key={c.id}
                            type="button"
                            disabled={!isUnlocked}
                            onClick={() => {
                              if (isUnlocked) setCurrentCritereIndex(idx)
                            }}
                            className={`w-8 h-8 rounded-full text-xs font-black transition-all shrink-0 flex items-center justify-center border ${
                              isCurrent
                                ? 'bg-[#D4AF37] text-[#002B49] shadow-md shadow-[#D4AF37]/40 ring-2 ring-[#F5E6AB] scale-105 border-[#F5E6AB]'
                                : isNoted
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                                : isUnlocked
                                ? 'bg-[#001D33] text-white border-white/30 hover:bg-[#003860]'
                                : 'bg-[#001829] text-white/40 border-white/10 opacity-40 cursor-not-allowed'
                            }`}
                            title={isUnlocked ? `Critère ${idx + 1}: ${c.libelle}` : `Répondez aux critères précédents d'abord`}
                          >
                            {isNoted && !isCurrent ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                          </button>
                        )
                      })}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[#D4AF37]/80 font-medium text-xs hidden md:inline">
                      {criteres.filter(c => (notes[currentEvalue.evalueId]?.[c.id]?.valeur || 0) > 0).length} / {criteres.length} rempli(s)
                    </span>
                    <span className="font-black text-[#D4AF37] text-xs sm:text-sm">
                      {Math.round(((currentCritereIndex + 1) / criteres.length) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Barre de progression horizontale animée */}
                <div className="h-1.5 w-full bg-[#001829] rounded-full overflow-hidden border border-[#D4AF37]/30 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#F5E6AB] rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.round(((currentCritereIndex + 1) / criteres.length) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

            {/* Fiche Défilante du Critère Actif */}
            {criteres.length > 0 && (() => {
              const critere = criteres[currentCritereIndex] || criteres[0]
              const critIdx = currentCritereIndex
              const noteValue = notes[currentEvalue.evalueId]?.[critere.id]?.valeur || 0
              const options = getAppreciationOptions(critere.noteMaximale)

              return (
                <div key={critere.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 mb-3 animate-fade-in space-y-4">
                  {/* Entête du critère */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-lg sm:text-xl text-[#002B49] tracking-tight" style={{ color: '#002B49', fontFamily: 'var(--font-outfit), sans-serif' }}>{critere.libelle}</h3>
                      </div>
                      {critere.description && (
                        <p
                          className="font-medium leading-snug text-[#965A00] text-sm"
                          style={{ color: '#965A00' }}
                        >
                          {critere.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-black text-slate-700 shadow-sm">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        {noteValue > 0 ? `${noteValue} / ${critere.noteMaximale} pts` : `Échelle sur ${critere.noteMaximale} pts`}
                      </span>
                    </div>
                  </div>

                  {/* Grille des Appréciations / Barème */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {options.map((opt, optIdx) => {
                      const isSelected = noteValue === opt.note
                      return (
                        <button
                          key={opt.note}
                          type="button"
                          disabled={currentEvalue.statut === 'TERMINEE'}
                          onClick={() => {
                            handleNoteChange(currentEvalue.evalueId, critere.id, opt.note)
                          }}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between gap-3 active:scale-[0.99] ${
                            isSelected
                              ? 'border-slate-800 bg-slate-100/90 shadow-sm ring-2 ring-slate-400'
                              : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="min-w-0 flex-1">
                              <span
                                className="font-bold block leading-tight text-slate-800 text-sm sm:text-base"
                                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                              >
                                {optIdx + 1} - {opt.appreciation}
                              </span>
                              <span
                                className="font-semibold block text-[#002B49] leading-tight mt-0.5 text-xs"
                                style={{ color: '#002B49' }}
                              >
                                {opt.description}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-sm">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-200 bg-white" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Commentaire optionnel */}
                  <div className="pt-1">
                    <textarea
                      placeholder="Commentaire ou justification (optionnel)..."
                      value={notes[currentEvalue.evalueId]?.[critere.id]?.commentaire || ''}
                      onChange={(e) =>
                        handleCommentaireChange(
                          currentEvalue.evalueId,
                          critere.id,
                          e.target.value
                        )
                      }
                      disabled={currentEvalue.statut === 'TERMINEE'}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs resize-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 outline-none disabled:bg-slate-50 bg-slate-50/40 font-medium text-slate-700"
                      rows={1}
                    />
                  </div>

                  {/* Boutons de Défilement des Critères (Précédent / Suivant) */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentCritereIndex(Math.max(0, currentCritereIndex - 1))}
                      disabled={currentCritereIndex === 0}
                      className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" /> Critère précédent
                    </button>

                    <div className="text-xs font-bold text-slate-500">
                      Total : <span className="font-black text-slate-800 text-sm">{currentScoreSubtotal}</span> / {maxSubtotal} pts
                    </div>

                    {currentCritereIndex < criteres.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentCritereIndex(currentCritereIndex + 1)}
                        disabled={noteValue === 0}
                        className="w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs sm:text-sm shadow-md shadow-slate-200 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title={noteValue === 0 ? "Veuillez attribuer une note à ce critère avant de continuer" : ""}
                      >
                        Critère suivant <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (currentIndex < affectations.length - 1) {
                            navigateToCollaborator(currentIndex + 1)
                          }
                        }}
                        disabled={currentIndex >= affectations.length - 1 || noteValue === 0}
                        className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs sm:text-sm shadow-md shadow-emerald-100 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Collaborateur suivant <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Barre de navigation globale & Sauvegarde Brouillon */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigateToCollaborator(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 hover:text-slate-900 font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Collaborateur précédent
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={savingDraft || currentEvalue.statut === 'TERMINEE'}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm disabled:opacity-50 transition-colors"
              >
                {savingDraft ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-brand-600" />
                    Sauvegarder le brouillon
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigateToCollaborator(currentIndex + 1)}
                disabled={currentIndex === affectations.length - 1}
                className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 hover:text-slate-900 font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm transition-colors"
              >
                Collaborateur suivant <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* BOUTON DE SOUMISSION FINALE — Toujours visible en bas     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="mt-8 mb-2">
              <div className="bg-gradient-to-br from-[#002B49] to-[#001829] rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-black text-white mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                      Clôturer définitivement les évaluations
                    </h3>
                    <p className="text-sm text-[#D4AF37]/80" style={{ fontFamily: 'var(--font-inter)' }}>
                      {completionCount} / {affectations.length} collègue{affectations.length > 1 ? 's' : ''} noté{completionCount > 1 ? 's' : ''} —{' '}
                      {completionCount === affectations.length ? (
                        <span className="text-emerald-400 font-bold">Toutes les évaluations sont complètes ✓</span>
                      ) : (
                        <span className="text-amber-400 font-bold">Évaluations incomplètes</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmitAll}
                    disabled={submitting}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl font-black flex items-center justify-center gap-3 text-base shadow-lg shadow-emerald-900/30 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'var(--font-outfit)' }}
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        Envoi en cours…
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Soumettre toutes les évaluations
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL DE VALIDATION (critère manquant)                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {validationError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,24,47,0.65)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 max-w-md w-full animate-fade-in text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-amber-50 border-2 border-amber-200">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
              Formulaire incomplet
            </h3>
            <p className="text-sm text-slate-600 mb-6" style={{ fontFamily: 'var(--font-inter)' }}>
              {validationError}
            </p>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="w-full px-6 py-3.5 bg-[#002B49] hover:bg-[#001829] text-white rounded-2xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg"
            >
              Compris, corriger maintenant
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL DE CONFIRMATION FINALE                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,24,47,0.70)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 max-w-lg w-full animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-orange-50 border-2 border-orange-200">
                <ShieldAlert className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                Confirmer la soumission définitive
              </h3>
              <p className="text-sm text-slate-600 mb-2" style={{ fontFamily: 'var(--font-inter)' }}>
                Vous êtes sur le point de soumettre <strong>{affectations.length} évaluation{affectations.length > 1 ? 's' : ''}</strong> de manière <strong>définitive et irréversible</strong>.
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 my-6 text-left">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-orange-700" style={{ fontFamily: 'var(--font-inter)' }}>
                    <p className="font-bold mb-1">Cette action est irréversible :</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Vos notes seront enregistrées et verrouillées</li>
                      <li>Vous ne pourrez plus modifier ces évaluations</li>
                      <li>L'accès à cette page d'évaluation sera définitivement fermé</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={executeSubmit}
                disabled={submitting}
                className="flex-1 px-6 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-sm transition-all active:scale-[0.98] shadow-lg shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Envoi en cours…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Oui, soumettre définitivement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
