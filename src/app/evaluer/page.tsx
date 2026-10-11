'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Loader2,
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
  typeEvaluateurs?: string[]
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

  const getActiveCriteresForEvalue = (aff: Affectation | undefined) => {
    if (!aff || !evaluateur) return []
    return criteres.filter(c => {
      const types = c.typeEvaluateurs && c.typeEvaluateurs.length > 0 ? c.typeEvaluateurs : [c.typeEvaluateur]
      if (types.includes('TOUS')) return true
      if (isManager && types.includes('MANAGER')) return true
      if (!isManager) {
        if (types.includes('COLLEGUE') && aff.evalue.service === evaluateur.service) return true
        if (types.includes('CLIENT_INTERNE') && aff.evalue.service !== evaluateur.service) return true
      }
      return false
    })
  }

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
      const currentCriteres = getActiveCriteresForEvalue(current)
      const isCompleted =
        currentCriteres.length > 0 &&
        currentCriteres.every((c) => (notes[current.evalueId]?.[c.id]?.valeur || 0) > 0)
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
      const currentAffCriteres = getActiveCriteresForEvalue(affectations[currentIndex])
      const isLastCritere = currentCritereIndex === currentAffCriteres.length - 1
      if (isLastCollaborator && isLastCritere) {
        const currentAff = affectations[currentIndex]
        const allThisAffDone = currentAffCriteres.every(
          (c) => (c.id === critereId ? valeur > 0 : (updated[evalueId]?.[c.id]?.valeur || 0) > 0)
        )
        const allOthersDone = affectations.every(
          (a) =>
            a.evalueId === evalueId ||
            getActiveCriteresForEvalue(a).every((c) => (updated[a.evalueId]?.[c.id]?.valeur || 0) > 0)
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
      const affCriteres = getActiveCriteresForEvalue(aff)
      for (const crit of affCriteres) {
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
      const affCriteres = getActiveCriteresForEvalue(aff)
      const all = affCriteres.every((c) => (notes[aff.evalueId]?.[c.id]?.valeur || 0) > 0)
      if (all && affCriteres.length > 0) done++
    }
    return done
  }, [affectations, criteres, notes, evaluateur, isManager])

  const currentEvalue = affectations[currentIndex]
  const currentAffCriteres = useMemo(() => getActiveCriteresForEvalue(currentEvalue), [currentEvalue, criteres, evaluateur, isManager])
  const currentScoreSubtotal = useMemo(() => {
    if (!currentEvalue) return 0
    return currentAffCriteres.reduce(
      (sum, c) => sum + (notes[currentEvalue.evalueId]?.[c.id]?.valeur || 0),
      0
    )
  }, [currentAffCriteres, notes, currentEvalue])

  const maxSubtotal = useMemo(
    () => criteres.reduce((sum, c) => sum + c.noteMaximale, 0),
    [criteres]
  )

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-[var(--font-inter)]">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center max-w-md w-full animate-fade-in">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-emerald-50 text-emerald-600">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-[#002B49] font-[var(--font-outfit)]">
            Évaluations terminées
          </h2>
          <p className="text-slate-600 mb-8">
            Vos notes ont été enregistrées et verrouillées. Merci de votre participation.
          </p>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-[#002B49] hover:bg-[#001829] text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-[#002B49] animate-spin" />
      </div>
    )
  }

  if (error) {
    const isUserAdmin = evaluateur?.role === 'ADMIN'
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-[var(--font-inter)]">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2 font-[var(--font-outfit)]">
            Erreur de chargement
          </h2>
          <p className="text-slate-600 mb-8">{error}</p>
          
          {isUserAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full mb-3 px-4 py-3 bg-[#D4AF37] text-[#002B49] rounded-lg font-bold hover:bg-[#C5A059] transition-colors"
            >
              Accéder à l'administration
            </button>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
            >
              Quitter
            </button>
            <button
              onClick={() => loadData()}
              className="flex-1 px-4 py-3 bg-[#002B49] text-white rounded-lg font-semibold hover:bg-[#001829] transition-colors"
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
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-[var(--font-inter)] text-slate-900">
      
      {/* ================= HEADER & TABS (FIGÉ / NON-SCROLLABLE) ================= */}
      <div className="shrink-0 z-40 flex flex-col shadow-sm bg-white">
        {/* Top Header */}
        <header className="bg-[#002B49] text-white">
          <div className="max-w-[1344px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center text-[#002B49]">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold font-[var(--font-outfit)] leading-none">
                  {evaluateur?.prenom} {evaluateur?.nom}
                </p>
                <p className="text-xs text-white/70 mt-1">
                  Session Notant
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/70 hover:text-white transition-colors p-2"
              title="Se déconnecter"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full bg-[#001829]">
            <div
              className="h-full bg-[#D4AF37] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        {/* Global Progress & Colleague Tabs */}
        <div className="bg-slate-50/95 backdrop-blur-md pt-6 pb-2 border-b border-slate-200/80">
          <div className="max-w-[1344px] mx-auto px-4 sm:px-6 w-full">
            {/* Global Progress & Info */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[#002B49] font-[var(--font-outfit)] mb-1">
                  Évaluation des collaborateurs
                </h1>
                <p className="text-sm text-slate-600">
                  {completionCount} sur {affectations.length} évalué{affectations.length > 1 ? 's' : ''}
                  {campagne && ` • Pondération : collègues ${campagne.poidsCollegues} / manager ${campagne.poidsManager}`}
                </p>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={savingDraft || currentEvalue?.statut === 'TERMINEE'}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-slate-500" />}
                  Brouillon
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={submitting || completionCount !== affectations.length}
                  className="px-4 py-2 text-sm font-medium text-[#002B49] bg-[#D4AF37] rounded-lg hover:bg-[#C5A059] transition-colors disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 flex items-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  Soumettre
                </button>
              </div>
            </div>

            {feedback && (
              <div className={`mb-4 p-3 rounded-lg text-sm flex items-start gap-3 ${
                feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <p>{feedback.msg}</p>
              </div>
            )}

            {/* Colleague Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {affectations.map((aff, idx) => {
                const affCriteres = getActiveCriteresForEvalue(aff)
                const isCompleted = affCriteres.length > 0 && affCriteres.every((c) => (notes[aff.evalueId]?.[c.id]?.valeur || 0) > 0)
                const isActive = idx === currentIndex
                const isUnlocked = idx === 0 || affectations.slice(0, idx).every(prevAff => getActiveCriteresForEvalue(prevAff).every(c => (notes[prevAff.evalueId]?.[c.id]?.valeur || 0) > 0))
                
                return (
                  <button
                    key={aff.id}
                    onClick={() => isUnlocked && navigateToCollaborator(idx)}
                    disabled={!isUnlocked}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors border ${
                      isActive 
                        ? 'border-[#002B49] bg-[#002B49] text-white shadow-sm'
                        : isCompleted
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : isUnlocked
                            ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {isCompleted && !isActive && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    {!isCompleted && !isActive && <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                    {aff.evalue.prenom} {aff.evalue.nom}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {/* ========================================================= */}

      {/* Main Content (Scrollable independently below frozen header) */}
      <main className="flex-1 w-full overflow-y-auto flex flex-col pt-6 pb-20 custom-scrollbar">
        <div className="max-w-[1344px] mx-auto w-full px-4 sm:px-6 mb-12">
          {currentEvalue && (
            <div className="space-y-6 animate-fade-in">
              {currentAffCriteres.length > 0 && currentAffCriteres.map((critere, critIdx) => {
                const noteValue = notes[currentEvalue.evalueId]?.[critere.id]?.valeur || 0
                const options = getAppreciationOptions(critere.noteMaximale)
                const isUnlocked = critIdx === 0 || currentAffCriteres.slice(0, critIdx).every((prevC) => (notes[currentEvalue.evalueId]?.[prevC.id]?.valeur || 0) > 0)

                return (
                  <div 
                    key={critere.id} 
                    className={`bg-white rounded-2xl border p-6 sm:p-8 transition-all duration-300 ${
                      isUnlocked ? 'border-slate-200 shadow-sm opacity-100' : 'border-slate-100 opacity-40 pointer-events-none select-none'
                    }`}
                  >
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#002B49]/5 text-[#002B49] font-bold text-sm">
                          {critIdx + 1}
                        </span>
                        <h2 className="text-lg font-bold text-[#002B49] font-[var(--font-outfit)]">
                          {critere.libelle}
                        </h2>
                      </div>
                      {critere.description && (
                        <p className="text-sm text-slate-600 ml-10">
                          {critere.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-0 sm:ml-10">
                      {options.map((opt) => {
                        const isSelected = noteValue === opt.note
                        return (
                          <button
                            key={opt.note}
                            onClick={() => handleNoteChange(currentEvalue.evalueId, critere.id, opt.note)}
                            disabled={currentEvalue.statut === 'TERMINEE'}
                            className={`text-left p-4 rounded-xl border transition-all flex gap-3 ${
                              isSelected
                                ? 'border-[#002B49] bg-[#002B49]/5 ring-1 ring-[#002B49]'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            <div className={`mt-0.5 w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-[#002B49] bg-[#002B49]' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm mb-1">{opt.appreciation}</div>
                              <div className="text-xs text-slate-500 leading-relaxed">{opt.description}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <div className="mt-6 ml-0 sm:ml-10">
                      <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                        Commentaire (optionnel)
                      </label>
                      <textarea
                        placeholder="Ajouter une précision..."
                        value={notes[currentEvalue.evalueId]?.[critere.id]?.commentaire || ''}
                        onChange={(e) => handleCommentaireChange(currentEvalue.evalueId, critere.id, e.target.value)}
                        disabled={currentEvalue.statut === 'TERMINEE'}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002B49]/20 focus:border-[#002B49] transition-colors resize-none disabled:bg-slate-100"
                        rows={2}
                      />
                    </div>
                  </div>
                )
              })}
              
              {/* Validation Button */}
              {(() => {
                const isCurrentCompleted = currentAffCriteres.length > 0 && currentAffCriteres.every((c) => (notes[currentEvalue.evalueId]?.[c.id]?.valeur || 0) > 0)
                
                return (
                  <div className="pt-6 flex justify-end mt-4">
                    <button
                      onClick={() => {
                        if (currentIndex < affectations.length - 1) {
                          navigateToCollaborator(currentIndex + 1)
                        } else {
                          setShowConfirmModal(true)
                        }
                      }}
                      disabled={!isCurrentCompleted || currentEvalue.statut === 'TERMINEE'}
                      className="px-6 py-3.5 text-sm font-bold text-white bg-[#002B49] rounded-xl hover:bg-[#001829] transition-all disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 flex items-center gap-2 shadow-sm font-[var(--font-outfit)]"
                    >
                      Valider pour {currentEvalue.evalue.prenom} {currentEvalue.evalue.nom}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </main>

      {/* Validation Modal */}
      {validationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2 font-[var(--font-outfit)]">
              Évaluation incomplète
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              {validationError}
            </p>
            <button
              onClick={() => setValidationError(null)}
              className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Continuer
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-[#002B49] font-[var(--font-outfit)]">
                Clôture des évaluations
              </h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Vous êtes sur le point de soumettre définitivement les évaluations pour <strong>{affectations.length} collaborateur{affectations.length > 1 ? 's' : ''}</strong>. 
              Cette action est <span className="font-semibold text-slate-900">irréversible</span>. Vos notes seront verrouillées et vous ne pourrez plus les modifier.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={executeSubmit}
                disabled={submitting}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#002B49] rounded-lg hover:bg-[#001829] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Soumettre définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Transition Collaborateur */}
      {transitionToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#002B49] text-white p-4 rounded-xl shadow-lg flex items-start gap-4 animate-fade-in">
          <div className="mt-0.5">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-1 font-[var(--font-outfit)]">
              Évaluation enregistrée
            </p>
            <p className="text-xs text-white/70">
              {transitionToast.prevNom} a été évalué avec succès.
            </p>
            {transitionToast.nextNom && (
              <p className="text-xs text-[#D4AF37] mt-2 flex items-center gap-1 font-medium">
                Passage à {transitionToast.nextNom} <ChevronRight className="w-3 h-3" />
              </p>
            )}
            {transitionToast.isFinal && (
              <p className="text-xs text-emerald-300 mt-2 font-medium">
                Toutes les évaluations sont prêtes à être soumises.
              </p>
            )}
          </div>
          <button onClick={() => setTransitionToast(null)} className="text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
