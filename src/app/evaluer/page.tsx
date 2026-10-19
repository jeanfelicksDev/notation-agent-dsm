'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Award,
  LogOut,
  Save,
  Send,
  Check,
  Star,
  ShieldCheck,
  Lock,
  Search,
  Filter,
  Info,
  SlidersHorizontal,
  LayoutList,
  Sparkles,
  Menu,
  X,
  FileText,
  BadgeCheck,
} from 'lucide-react'
import { getAppreciationOptions, getAppreciationInfo } from '@/lib/default-criteres'

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

  // UI States
  const [loading, setLoading] = useState(true)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  
  // Navigation & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'tous' | 'a_faire' | 'termines'>('tous')
  const [viewMode, setViewMode] = useState<'focus' | 'all'>('focus')
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Notification Toast transition
  const [transitionToast, setTransitionToast] = useState<{
    prevNom: string
    nextNom?: string
    isFinal?: boolean
  } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setCurrentCritereIndex(0)
  }, [currentIndex])

  useEffect(() => {
    if (!transitionToast) return
    const t = setTimeout(() => setTransitionToast(null), 4500)
    return () => clearTimeout(t)
  }, [transitionToast])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3500)
    return () => clearTimeout(t)
  }, [feedback])

  const getActiveCriteresForEvalue = (aff: Affectation | undefined) => {
    if (!aff || !evaluateur) return []
    return criteres.filter((c) => {
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
        setError(data.error || 'Erreur lors du chargement des données')
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

  const isAffCompleted = (aff: Affectation) => {
    const affCriteres = getActiveCriteresForEvalue(aff)
    return affCriteres.length > 0 && affCriteres.every((c) => (notes[aff.evalueId]?.[c.id]?.valeur || 0) > 0)
  }

  const isAffUnlocked = (targetIdx: number) => {
    if (targetIdx === 0) return true
    return affectations
      .slice(0, targetIdx)
      .every((prevAff) => isAffCompleted(prevAff))
  }

  const navigateToCollaborator = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= affectations.length || targetIdx === currentIndex) return
    const current = affectations[currentIndex]
    const target = affectations[targetIdx]

    if (current && target && isAffCompleted(current)) {
      setTransitionToast({
        prevNom: `${current.evalue.prenom} ${current.evalue.nom}`,
        nextNom: `${target.evalue.prenom} ${target.evalue.nom}`,
        isFinal: false,
      })
    }
    handleSave()
    setCurrentIndex(targetIdx)
    setCurrentCritereIndex(0)
    setMobileDrawerOpen(false)
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

      // Auto-avance au critère suivant si en mode focus
      const currentAff = affectations[currentIndex]
      const currentAffCriteres = getActiveCriteresForEvalue(currentAff)
      if (currentCritereIndex < currentAffCriteres.length - 1) {
        // Avancer en douceur vers le prochain critère
        setTimeout(() => {
          setCurrentCritereIndex((prevIdx) => Math.min(prevIdx + 1, currentAffCriteres.length - 1))
        }, 180)
      } else {
        // Dernier critère du collaborateur
        const isLastCollaborator = currentIndex === affectations.length - 1
        const allThisAffDone = currentAffCriteres.every(
          (c) => (c.id === critereId ? valeur > 0 : (updated[evalueId]?.[c.id]?.valeur || 0) > 0)
        )
        const allOthersDone = affectations.every(
          (a) =>
            a.evalueId === evalueId ||
            getActiveCriteresForEvalue(a).every((c) => (updated[a.evalueId]?.[c.id]?.valeur || 0) > 0)
        )
        if (isLastCollaborator && allThisAffDone && allOthersDone) {
          setTransitionToast({
            prevNom: `${currentAff.evalue.prenom} ${currentAff.evalue.nom}`,
            isFinal: true,
          })
        }
      }

      return updated
    })
  }

  const handleCommentaireChange = (evalueId: string, critereId: string, commentaire: string) => {
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

    if (notesToSave.length === 0) return

    setSavingDraft(true)
    try {
      const res = await fetch('/api/evaluation/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evalueId: current.evalueId, notes: notesToSave }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({ type: 'success', msg: 'Brouillon sauvegardé automatiquement' })
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
      setFeedback({ type: 'error', msg: 'Erreur réseau lors de la sauvegarde' })
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSubmitAll = () => {
    for (const aff of affectations) {
      const affCriteres = getActiveCriteresForEvalue(aff)
      for (const crit of affCriteres) {
        const val = notes[aff.evalueId]?.[crit.id]?.valeur || 0
        if (val === 0) {
          const idx = affectations.findIndex((a) => a.id === aff.id)
          const errMsg = `Le critère "${crit.libelle}" n'est pas encore renseigné pour ${aff.evalue.prenom} ${aff.evalue.nom}`
          setCurrentIndex(idx)
          setFeedback({ type: 'error', msg: errMsg })
          setValidationError(errMsg)
          return
        }
      }
    }
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
          userMsg = "Accès refusé : certaines évaluations ne vous sont pas affectées ou l'auto-évaluation a été détectée."
        } else if (res.status === 401) {
          window.location.href = '/?reason=session_expired'
          return
        }
        setFeedback({ type: 'error', msg: userMsg })
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Erreur réseau lors de la transmission' })
    } finally {
      setSubmitting(false)
    }
  }

  // Métriques globales
  const completionCount = useMemo(() => {
    let done = 0
    for (const aff of affectations) {
      if (isAffCompleted(aff)) done++
    }
    return done
  }, [affectations, criteres, notes, evaluateur, isManager])

  const progressPct =
    affectations.length === 0 ? 0 : Math.round((completionCount / affectations.length) * 100)

  const currentEvalue = affectations[currentIndex]
  const currentAffCriteres = useMemo(
    () => getActiveCriteresForEvalue(currentEvalue),
    [currentEvalue, criteres, evaluateur, isManager]
  )

  const currentScoreSubtotal = useMemo(() => {
    if (!currentEvalue) return 0
    return currentAffCriteres.reduce(
      (sum, c) => sum + (notes[currentEvalue.evalueId]?.[c.id]?.valeur || 0),
      0
    )
  }, [currentAffCriteres, notes, currentEvalue])

  const currentMaxSubtotal = useMemo(
    () => currentAffCriteres.reduce((sum, c) => sum + c.noteMaximale, 0),
    [currentAffCriteres]
  )

  // Règle DSM TAMIS : barème sur 55 pour le manager, sur 45 pour collègues & clients internes
  const baremeMax = isManager ? 55 : 45
  const currentScoreScaled = useMemo(() => {
    if (currentMaxSubtotal === 0) return 0
    return Math.round((currentScoreSubtotal / currentMaxSubtotal) * baremeMax * 10) / 10
  }, [currentScoreSubtotal, currentMaxSubtotal, baremeMax])

  const currentScorePercent = currentMaxSubtotal > 0 ? (currentScoreSubtotal / currentMaxSubtotal) * 100 : 0
  const currentAppreciationInfo = getAppreciationInfo(currentScorePercent)

  const getScaledScoreForAff = (aff: Affectation) => {
    const affCriteres = getActiveCriteresForEvalue(aff)
    const rawTotal = affCriteres.reduce((sum, c) => sum + (notes[aff.evalueId]?.[c.id]?.valeur || 0), 0)
    const rawMax = affCriteres.reduce((sum, c) => sum + c.noteMaximale, 0)
    return rawMax > 0 ? Math.round((rawTotal / rawMax) * baremeMax * 10) / 10 : 0
  }

  const isCurrentAffCompleted = currentEvalue ? isAffCompleted(currentEvalue) : false

  // Filtrage des collaborateurs dans la liste
  const filteredAffectations = useMemo(() => {
    return affectations.filter((aff) => {
      const nomComplet = `${aff.evalue.prenom} ${aff.evalue.nom} ${aff.evalue.matricule} ${aff.evalue.service || ''}`.toLowerCase()
      const matchesSearch = searchQuery === '' || nomComplet.includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      const done = isAffCompleted(aff)
      if (filterTab === 'a_faire') return !done
      if (filterTab === 'termines') return done
      return true
    })
  }, [affectations, searchQuery, filterTab, notes, criteres, evaluateur, isManager])

  // ==================== RENDU : SUCCÈS SOUMISSION DÉFINITIVE ====================
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 font-sans text-white">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-10 text-center max-w-lg w-full backdrop-blur-xl">
          <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <p className="text-[#D4AF37] font-semibold text-xs tracking-widest uppercase mb-2">
            Direction des Solutions Maritimes • DSM TAMIS
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-white tracking-tight">
            Évaluations enregistrées et clôturées
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            Vos notations pour l'ensemble des collaborateurs affectés ont été validées et transmises définitivement à l'administration. Vos avis sont désormais verrouillés.
          </p>

          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/50 mb-8 flex items-center justify-between text-xs text-slate-400">
            <span>Collaborateurs évalués : <strong className="text-white">{affectations.length}</strong></span>
            <span>Statut : <strong className="text-emerald-400 font-medium">Archivée & Scellée</strong></span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full px-5 py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#C5A059] hover:from-[#e5bd3d] hover:to-[#d4af37] text-[#002B49] rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <LogOut className="w-4 h-4" />
            Fermer la session et quitter
          </button>
        </div>
      </div>
    )
  }

  // ==================== RENDU : CHARGEMENT ====================
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#002B49] flex items-center justify-center shadow-lg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="3" />
              <line x1="12" y1="22" x2="12" y2="8" />
              <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
            </svg>
          </div>
          <Loader2 className="w-20 h-20 text-[#002B49] animate-spin absolute -inset-2 opacity-30" />
        </div>
        <p className="text-sm font-medium text-slate-600 mt-2">Chargement du portail d'évaluation...</p>
      </div>
    )
  }

  // ==================== RENDU : ERREUR ====================
  if (error) {
    const isUserAdmin = evaluateur?.role === 'ADMIN'
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Erreur de chargement</h2>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          {isUserAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full mb-3 px-4 py-2.5 bg-[#D4AF37] text-[#002B49] rounded-lg font-bold hover:bg-[#C5A059] transition-colors text-sm"
            >
              Accéder au module Administration
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm"
            >
              Quitter
            </button>
            <button
              onClick={() => loadData()}
              className="flex-1 px-4 py-2.5 bg-[#002B49] text-white rounded-lg font-medium hover:bg-[#001829] transition-colors text-sm"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==================== INTERFACE PRINCIPALE DE NOTATION ====================
  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900 font-sans overflow-hidden select-none">
      
      {/* ── BARRE DE NAVIGATION SUPÉRIEURE ── */}
      <header className="h-16 shrink-0 bg-[#002B49] text-white border-b border-[#001f35] flex items-center justify-between px-4 sm:px-6 z-30">
        <div className="flex items-center gap-3">
          {/* Bouton mobile pour ouvrir le tiroir des collaborateurs */}
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            aria-label="Ouvrir la liste des collaborateurs"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Marque DSM TAMIS avec Ancre maritime */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="3" />
                <line x1="12" y1="22" x2="8" />
                <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-base leading-none">DSM</span>
                <span className="font-bold text-[#D4AF37] text-base leading-none">TAMIS</span>
                <span className="hidden sm:inline-block text-[11px] font-medium bg-white/10 text-white/90 px-2 py-0.5 rounded-full border border-white/10">
                  {isManager ? 'Évaluation Manager' : 'Évaluation Collègues'}
                </span>
              </div>
              <p className="text-[11px] text-white/60 leading-tight mt-0.5 hidden sm:block">
                Direction des Solutions Maritimes • Campagne en cours
              </p>
            </div>
          </div>
        </div>

        {/* Progression globale & Actions de sauvegarde / validation */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Jauge globale compacte */}
          <div className="hidden md:flex flex-col items-end mr-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="text-white/70">Progression globale :</span>
              <span className="text-white font-bold">{completionCount} / {affectations.length}</span>
              <span className="text-[#D4AF37] font-semibold">({progressPct}%)</span>
            </div>
            <div className="w-36 h-2 bg-[#001829] rounded-full overflow-hidden mt-1 border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Bouton Brouillon */}
          <button
            onClick={handleSave}
            disabled={savingDraft || currentEvalue?.statut === 'TERMINEE'}
            title="Sauvegarder l'état actuel en brouillon"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/90 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors disabled:opacity-40"
          >
            {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" /> : <Save className="w-3.5 h-3.5 text-[#D4AF37]" />}
            <span>Brouillon</span>
          </button>

          {/* Bouton de Soumission Définitive */}
          <button
            onClick={handleSubmitAll}
            disabled={submitting || completionCount !== affectations.length}
            className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm ${
              completionCount === affectations.length
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#c59d24] text-[#002B49] hover:brightness-105 ring-2 ring-[#D4AF37]/50 animate-pulse'
                : 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
            }`}
          >
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Clôturer & Soumettre</span>
          </button>

          {/* Profil notant & Déconnexion */}
          <div className="h-6 w-px bg-white/15 mx-1 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-xs font-bold" title={`${evaluateur?.prenom} ${evaluateur?.nom}`}>
              {evaluateur?.prenom?.[0]}{evaluateur?.nom?.[0]}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── CORPS DE L'APPLICATION (MASTER - DETAIL) ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── VOLET GAUCHE : LISTE DES COLLABORATEURS ── */}
        <aside
          className={`
            fixed inset-y-0 left-0 top-16 z-20 w-80 sm:w-88 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out
            lg:static lg:translate-x-0
            ${mobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Entête du volet */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-[#002B49] tracking-tight">Collaborateurs affectés</h2>
                <p className="text-xs text-slate-500">
                  {completionCount} complété{completionCount > 1 ? 's' : ''} sur {affectations.length}
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                {progressPct}%
              </span>
            </div>

            {/* Barre de recherche rapide */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002B49] focus:border-[#002B49]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filtres par onglets */}
            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setFilterTab('tous')}
                className={`py-1 rounded text-center transition-colors ${
                  filterTab === 'tous' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({affectations.length})
              </button>
              <button
                onClick={() => setFilterTab('a_faire')}
                className={`py-1 rounded text-center transition-colors ${
                  filterTab === 'a_faire' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                À faire ({affectations.length - completionCount})
              </button>
              <button
                onClick={() => setFilterTab('termines')}
                className={`py-1 rounded text-center transition-colors ${
                  filterTab === 'termines' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Finis ({completionCount})
              </button>
            </div>
          </div>

          {/* Liste déroulante des collaborateurs */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredAffectations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Aucun collaborateur ne correspond à ces critères.
              </div>
            ) : (
              filteredAffectations.map((aff) => {
                const globalIdx = affectations.findIndex((a) => a.id === aff.id)
                const isActive = globalIdx === currentIndex
                const isCompleted = isAffCompleted(aff)
                const isUnlocked = isAffUnlocked(globalIdx)
                const affCriteres = getActiveCriteresForEvalue(aff)
                const filledCount = affCriteres.filter((c) => (notes[aff.evalueId]?.[c.id]?.valeur || 0) > 0).length
                
                // Calcul sous-total collaborateur
                const affTotal = affCriteres.reduce((sum, c) => sum + (notes[aff.evalueId]?.[c.id]?.valeur || 0), 0)
                const affMax = affCriteres.reduce((sum, c) => sum + c.noteMaximale, 0)

                return (
                  <button
                    key={aff.id}
                    onClick={() => isUnlocked && navigateToCollaborator(globalIdx)}
                    disabled={!isUnlocked}
                    className={`w-full text-left p-3.5 transition-all flex items-center gap-3 rounded-lg mx-1 ${
                      isActive
                        ? 'bg-[#002B49]/8 text-[#002B49] ring-1 ring-inset ring-[#002B49]/15'
                        : isUnlocked
                        ? 'hover:bg-slate-50'
                        : 'opacity-40 cursor-not-allowed bg-slate-50/50'
                    }`}
                  >
                    {/* Avatar Initiale avec Badge de Statut */}
                    <div className="relative shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                          isActive
                            ? 'bg-[#002B49] text-white shadow-sm'
                            : isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {aff.evalue.prenom?.[0]}{aff.evalue.nom?.[0]}
                      </div>
                      {isCompleted && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                      {!isUnlocked && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-slate-400 text-white flex items-center justify-center ring-2 ring-white">
                          <Lock className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    {/* Informations du collaborateur */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-bold truncate ${isActive ? 'text-[#002B49]' : 'text-slate-900'}`}>
                          {aff.evalue.prenom} {aff.evalue.nom}
                        </p>
                        {isCompleted ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 shrink-0">
                            {getScaledScoreForAff(aff)}/{baremeMax} pts
                          </span>
                        ) : filledCount > 0 ? (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 shrink-0">
                            {filledCount}/{affCriteres.length}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {aff.evalue.service || 'Service non spécifié'}
                        {aff.evalue.site?.nom ? ` • ${aff.evalue.site.nom}` : ''}
                      </p>

                      {/* Barre de progression miniature */}
                      {!isCompleted && isUnlocked && (
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-[#002B49]"
                            style={{ width: `${(filledCount / Math.max(affCriteres.length, 1)) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#002B49] translate-x-0.5' : 'text-slate-300'}`} />
                  </button>
                )
              })
            )}
          </div>

          {/* Pied du volet gauche */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Auto-évaluation exclue
            </span>
            <span className="font-semibold text-slate-700">Ordre alphabétique</span>
          </div>
        </aside>

        {/* Masque pour fermer le tiroir sur mobile */}
        {mobileDrawerOpen && (
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 top-16 bg-slate-900/40 z-10 lg:hidden backdrop-blur-xs"
          />
        )}

        {/* ── ESPACE CENTRAL : PLAN DE TRAVAIL D'ÉVALUATION ── */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-[#FAFAF8]">
          
          {currentEvalue ? (
            <div className="max-w-[1400px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6" data-purpose="evaluation-details-area">

              {/* 1. CARTE PROFIL DU COLLABORATEUR ACTIF (Stitch collaborator-profile-hero) */}
              <section
                className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                data-purpose="collaborator-profile-hero"
              >
                <div className="flex items-center gap-4">
                  {/* Monogram Box */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white font-bold text-lg flex items-center justify-center shadow-md ring-4 ring-slate-100 tracking-wider shrink-0">
                    {currentEvalue.evalue.prenom?.[0]}{currentEvalue.evalue.nom?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1
                        className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 font-sans"
                        style={{ fontFamily: '"Newsreader", Georgia, serif', fontSize: '1.5rem', letterSpacing: '-0.02em' }}
                      >
                        {currentEvalue.evalue.prenom} {currentEvalue.evalue.nom}
                      </h1>
                      <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                        Matricule : {currentEvalue.evalue.matricule}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 flex-wrap">
                      <span>{currentEvalue.evalue.service || 'Service non spécifié'}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                      <span className="font-medium text-zinc-700">Site : {currentEvalue.evalue.site?.nom || 'DOCUMENTATION'}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                      <span className="text-slate-900 font-medium">Affectation {currentIndex + 1} sur {affectations.length}</span>
                    </div>
                  </div>
                </div>

                {/* Score en direct & Synthèse */}
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl px-5 py-3 flex flex-col items-end shrink-0 self-start md:self-auto">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">
                    Score actuel ({isManager ? 'Manager' : 'Collègue / Client'})
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-950 font-mono tracking-tight">
                      {currentScoreScaled}
                    </span>
                    <span className="text-xs font-semibold text-zinc-400">/ {baremeMax} pts</span>
                  </div>
                  {currentScoreSubtotal > 0 && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border mt-1 ${currentAppreciationInfo.colorBadge}`}>
                      {currentAppreciationInfo.appreciation}
                    </span>
                  )}
                </div>
              </section>

              {/* 2. BARRE D'ONGLETS / STEPPER DE NAVIGATION ENTRE CRITÈRES (Stitch evaluation-criteria-stepper) */}
              <nav
                className="flex items-center justify-between gap-2 overflow-x-auto pb-1"
                data-purpose="evaluation-criteria-stepper"
              >
                <div className="flex items-center gap-2 min-w-max">
                  {currentAffCriteres.map((critere, critIdx) => {
                    const noteValue = notes[currentEvalue.evalueId]?.[critere.id]?.valeur || 0
                    const isSelected = viewMode === 'focus' && currentCritereIndex === critIdx
                    const isFilled = noteValue > 0
                    const isUnlocked = critIdx === 0 || currentAffCriteres.slice(0, critIdx).every((prevC) => (notes[currentEvalue.evalueId]?.[prevC.id]?.valeur || 0) > 0)

                    return (
                      <button
                        key={critere.id}
                        type="button"
                        onClick={() => {
                          if (isUnlocked) {
                            setViewMode('focus')
                            setCurrentCritereIndex(critIdx)
                          }
                        }}
                        disabled={!isUnlocked}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all ${
                          isSelected
                            ? 'bg-slate-950 text-white font-semibold shadow-sm'
                            : isFilled
                            ? 'bg-white hover:bg-emerald-50 text-emerald-800 font-medium border border-emerald-200/80 shadow-2xs'
                            : isUnlocked
                            ? 'bg-white hover:bg-zinc-100 text-zinc-600 font-medium border border-zinc-200/80'
                            : 'bg-zinc-50 text-zinc-300 font-medium border border-zinc-100 cursor-not-allowed'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : isFilled
                            ? 'bg-emerald-100 text-emerald-700 font-bold'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}>
                          {isFilled && !isSelected ? '✓' : critIdx + 1}
                        </span>
                        <span>{critere.libelle}</span>
                        {isFilled && (
                          <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-emerald-600 font-semibold'}`}>
                            ({noteValue}/{critere.noteMaximale})
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Bouton Vue Complète / Mode Focus */}
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'focus' ? 'all' : 'focus')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 hover:text-slate-900 bg-white border border-zinc-200/70 rounded-xl hover:bg-zinc-50 transition-all shrink-0 cursor-pointer"
                >
                  {viewMode === 'focus' ? (
                    <>
                      <LayoutList className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Vue complète</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Mode Focus</span>
                    </>
                  )}
                </button>
              </nav>

              {/* 3. CONTENU : MODE FOCUS (CRITÈRE PAR CRITÈRE) (Stitch active-criterion-form) */}
              {viewMode === 'focus' && currentAffCriteres[currentCritereIndex] && (() => {
                const critere = currentAffCriteres[currentCritereIndex]
                const critIdx = currentCritereIndex
                const noteValue = notes[currentEvalue.evalueId]?.[critere.id]?.valeur || 0
                const commentaire = notes[currentEvalue.evalueId]?.[critere.id]?.commentaire || ''
                const options = getAppreciationOptions(critere.noteMaximale)
                const isFirstCritere = critIdx === 0
                const isLastCritere = critIdx === currentAffCriteres.length - 1

                return (
                  <section
                    className="bg-white border border-zinc-200/80 rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col gap-6 animate-fade-in"
                    data-purpose="active-criterion-form"
                  >
                    {/* Criterion Title & Meta */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-md">
                          Critère {critIdx + 1} / {currentAffCriteres.length}
                        </span>
                        <span className="text-xs text-zinc-400">•</span>
                        <span className="text-xs text-zinc-500 font-medium">Barème sur {critere.noteMaximale} points</span>
                        {noteValue > 0 && (
                          <>
                            <span className="text-xs text-zinc-400">•</span>
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Note enregistrée : {noteValue} / {critere.noteMaximale}
                            </span>
                          </>
                        )}
                      </div>
                      <h2
                        className="text-2xl font-bold tracking-tight text-slate-950 mt-2"
                        style={{
                          fontFamily: '"Newsreader", Georgia, serif',
                          fontSize: '2rem',
                          fontWeight: 600,
                          letterSpacing: '-0.025em',
                          lineHeight: 1.2,
                        }}
                      >
                        {critere.libelle}
                      </h2>
                    </div>

                    {/* Criterion Definition Box */}
                    {critere.description && (
                      <div className="p-4 rounded-xl bg-zinc-50/80 border border-zinc-200/70 flex items-start gap-3.5">
                        <div className="w-6 h-6 rounded-full bg-blue-100/80 text-[#002B49] flex items-center justify-center shrink-0 mt-1">
                          <Info className="w-4 h-4 text-[#002B49]" />
                        </div>
                        <p
                          className="leading-relaxed font-semibold"
                          style={{
                            fontFamily: '"Newsreader", Georgia, serif',
                            fontSize: '1.375rem',
                            fontWeight: 600,
                            lineHeight: 1.6,
                            color: '#002B49',
                          }}
                        >
                          {critere.description}
                        </p>
                      </div>
                    )}

                    {/* Rating Selection Grid */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-700"
                          style={{
                            fontFamily: '"Plus Jakarta Sans", sans-serif',
                            fontSize: '0.875rem',
                            letterSpacing: '0.04em',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          Attribuer une appréciation :
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">
                          {noteValue > 0
                            ? `Option sélectionnée : ${noteValue} / ${critere.noteMaximale}`
                            : `Sélectionnez une option de 1 à ${critere.noteMaximale}`}
                        </span>
                      </div>

                      <div
                        className={`grid grid-cols-1 ${
                          critere.noteMaximale === 10 ? 'sm:grid-cols-5 gap-2.5' : 'md:grid-cols-5 gap-3'
                        }`}
                        data-purpose="rating-radio-group"
                      >
                        {options.map((opt) => {
                          const isSelected = noteValue === opt.note

                          return (
                            <div key={opt.note} className="rating-card relative">
                              <button
                                type="button"
                                onClick={() => handleNoteChange(currentEvalue.evalueId, critere.id, opt.note)}
                                disabled={currentEvalue.statut === 'TERMINEE'}
                                className={`w-full text-left h-full flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border transition-all duration-200 group cursor-pointer ${
                                  isSelected
                                    ? 'border-[#0F172A] bg-[#0F172A] text-white shadow-lg shadow-slate-950/20 -translate-y-0.5 ring-2 ring-slate-900'
                                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/70 text-slate-900'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                <div>
                                  <div
                                    className={`badge-num w-7 h-7 rounded-lg text-xs font-bold font-mono flex items-center justify-center mb-2 transition-colors ${
                                      isSelected
                                        ? 'bg-white text-slate-900 font-extrabold shadow-xs'
                                        : 'bg-zinc-100 group-hover:bg-zinc-200 text-slate-900'
                                    }`}
                                  >
                                    {opt.note}
                                  </div>
                                  <h4
                                    className={`font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-950'}`}
                                    style={{
                                      fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                                      fontSize: '1.05rem',
                                      letterSpacing: '-0.02em',
                                    }}
                                  >
                                    {opt.appreciation}
                                  </h4>
                                </div>
                                <p
                                  className={`rating-desc mt-1.5 leading-snug transition-colors ${
                                    isSelected ? 'text-slate-300' : 'text-zinc-600'
                                  }`}
                                  style={{
                                    fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                                    fontSize: '0.78rem',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {opt.description}
                                </p>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Qualitative Feedback Textarea */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="feedback"
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-700"
                          style={{
                            fontFamily: '"Newsreader", Georgia, serif',
                            fontSize: '0.875rem',
                            letterSpacing: '0.04em',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}
                        >
                          Observations &amp; Précisions Qualitatives
                        </label>
                        <span className="text-[11px] text-zinc-400 font-mono">Facultatif</span>
                      </div>
                      <div className="relative">
                        <textarea
                          id="feedback"
                          rows={4}
                          maxLength={500}
                          value={commentaire}
                          onChange={(e) => handleCommentaireChange(currentEvalue.evalueId, critere.id, e.target.value)}
                          disabled={currentEvalue.statut === 'TERMINEE'}
                          placeholder="Précisez un fait marquant, un axe d'amélioration ou un exemple concret pour étayer votre appréciation..."
                          className="w-full rounded-xl border border-zinc-200/90 bg-[#FBFBFA]/60 p-3.5 text-xs text-slate-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all resize-none shadow-xs"
                          style={{
                            fontFamily: '"Newsreader", Georgia, serif',
                            fontSize: '0.9375rem',
                            lineHeight: 1.6,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-400">
                        <span>Rétroaction constructive visible uniquement dans la synthèse consolidée.</span>
                        <span className="font-mono">{commentaire.length} / 500 caractères</span>
                      </div>
                    </div>

                    {/* Criterion Navigation Controls */}
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100 mt-2">
                      {/* Previous Button */}
                      <button
                        type="button"
                        onClick={() => setCurrentCritereIndex((prev) => Math.max(0, prev - 1))}
                        disabled={isFirstCritere}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition ${
                          isFirstCritere
                            ? 'text-zinc-300 bg-zinc-100/80 cursor-not-allowed'
                            : 'text-slate-700 bg-zinc-100 hover:bg-zinc-200 cursor-pointer'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Critère précédent</span>
                      </button>

                      {/* Next Button or Finish */}
                      {!isLastCritere ? (
                        <button
                          type="button"
                          onClick={() => setCurrentCritereIndex((prev) => Math.min(currentAffCriteres.length - 1, prev + 1))}
                          disabled={noteValue === 0}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-md shadow-slate-900/10 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <span>Critère suivant</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (currentIndex < affectations.length - 1) {
                              navigateToCollaborator(currentIndex + 1)
                            } else {
                              handleSubmitAll()
                            }
                          }}
                          disabled={!isCurrentAffCompleted}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md shadow-slate-900/10 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <span>
                            {currentIndex < affectations.length - 1
                              ? `Valider pour ${currentEvalue.evalue.prenom} et passer au suivant`
                              : 'Terminer toutes les notations'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </section>
                )
              })()}

              {/* 4. CONTENU : MODE VUE COMPLÈTE (TOUS LES CRITÈRES DÉROULÉS) */}
              {viewMode === 'all' && (
                <div className="space-y-6">
                  {currentAffCriteres.map((critere, critIdx) => {
                    const noteValue = notes[currentEvalue.evalueId]?.[critere.id]?.valeur || 0
                    const commentaire = notes[currentEvalue.evalueId]?.[critere.id]?.commentaire || ''
                    const options = getAppreciationOptions(critere.noteMaximale)
                    const isUnlocked = critIdx === 0 || currentAffCriteres.slice(0, critIdx).every((prevC) => (notes[currentEvalue.evalueId]?.[prevC.id]?.valeur || 0) > 0)

                    return (
                      <section
                        key={critere.id}
                        className={`bg-white border rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col gap-6 transition-all ${
                          isUnlocked ? 'border-zinc-200/80 shadow-xs' : 'border-zinc-100 opacity-40 pointer-events-none'
                        }`}
                      >
                        {/* Criterion Title & Meta */}
                        <div>
                          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-md">
                                Critère {critIdx + 1} / {currentAffCriteres.length}
                              </span>
                              <span className="text-xs text-zinc-400">•</span>
                              <span className="text-xs text-zinc-500 font-medium">Barème sur {critere.noteMaximale} points</span>
                            </div>
                            {noteValue > 0 && (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Note : {noteValue} / {critere.noteMaximale} pts
                              </span>
                            )}
                          </div>
                          <h3
                            className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 mt-1"
                            style={{
                              fontFamily: '"Newsreader", Georgia, serif',
                              fontSize: '1.5rem',
                              fontWeight: 600,
                              letterSpacing: '-0.025em',
                            }}
                          >
                            {critere.libelle}
                          </h3>
                        </div>

                        {/* Description Box */}
                        {critere.description && (
                          <div className="p-4 rounded-xl bg-zinc-50/80 border border-zinc-200/70 flex items-start gap-3.5">
                            <div className="w-6 h-6 rounded-full bg-blue-100/80 text-[#002B49] flex items-center justify-center shrink-0 mt-1">
                              <Info className="w-4 h-4 text-[#002B49]" />
                            </div>
                            <p
                              className="leading-relaxed font-semibold"
                              style={{
                                fontFamily: '"Newsreader", Georgia, serif',
                                fontSize: '1.375rem',
                                fontWeight: 600,
                                lineHeight: 1.6,
                                color: '#002B49',
                              }}
                            >
                              {critere.description}
                            </p>
                          </div>
                        )}

                        {/* Rating Options */}
                        <div className="space-y-2">
                          <label
                            className="block text-[11px] font-bold uppercase tracking-wider text-slate-700"
                            style={{
                              fontFamily: '"Plus Jakarta Sans", sans-serif',
                              fontSize: '0.85rem',
                              letterSpacing: '0.04em',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            Appréciation :
                          </label>
                          <div
                            className={`grid grid-cols-1 ${
                              critere.noteMaximale === 10 ? 'sm:grid-cols-5 gap-2.5' : 'md:grid-cols-5 gap-3'
                            }`}
                          >
                            {options.map((opt) => {
                              const isSelected = noteValue === opt.note

                              return (
                                <button
                                  key={opt.note}
                                  type="button"
                                  onClick={() => handleNoteChange(currentEvalue.evalueId, critere.id, opt.note)}
                                  disabled={currentEvalue.statut === 'TERMINEE'}
                                  className={`p-3 sm:p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 ${
                                    isSelected
                                      ? 'border-[#0F172A] bg-[#0F172A] text-white shadow-md shadow-slate-950/20 -translate-y-0.5 ring-1 ring-slate-900'
                                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60 text-slate-900'
                                  }`}
                                >
                                  <div>
                                    <div
                                      className={`w-6 h-6 rounded-md text-xs font-bold font-mono flex items-center justify-center mb-1.5 transition-colors ${
                                        isSelected
                                          ? 'bg-white text-slate-900 font-extrabold shadow-2xs'
                                          : 'bg-zinc-100 text-slate-900'
                                      }`}
                                    >
                                      {opt.note}
                                    </div>
                                    <h4
                                      className={`font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-950'}`}
                                      style={{
                                        fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                                        fontSize: '1rem',
                                        letterSpacing: '-0.02em',
                                      }}
                                    >
                                      {opt.appreciation}
                                    </h4>
                                  </div>
                                  <p
                                    className={`mt-1 leading-snug ${isSelected ? 'text-slate-300' : 'text-zinc-600'}`}
                                    style={{
                                      fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                                      fontSize: '0.76rem',
                                      lineHeight: 1.35,
                                    }}
                                  >
                                    {opt.description}
                                  </p>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Qualitative Feedback */}
                        <div className="space-y-1.5">
                          <label
                            className="block text-[11px] font-bold uppercase tracking-wider text-slate-700"
                            style={{
                              fontFamily: '"Newsreader", Georgia, serif',
                              fontSize: '0.85rem',
                              letterSpacing: '0.04em',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                            }}
                          >
                            Observations &amp; Précisions Qualitatives (Optionnel)
                          </label>
                          <textarea
                            rows={2}
                            maxLength={500}
                            placeholder="Observations complémentaires..."
                            value={commentaire}
                            onChange={(e) => handleCommentaireChange(currentEvalue.evalueId, critere.id, e.target.value)}
                            disabled={currentEvalue.statut === 'TERMINEE'}
                            className="w-full rounded-xl border border-zinc-200/90 bg-[#FBFBFA]/60 p-3 text-xs sm:text-sm text-slate-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all resize-none shadow-xs"
                            style={{ fontFamily: '"Newsreader", Georgia, serif', fontSize: '0.9rem', lineHeight: 1.5 }}
                          />
                        </div>
                      </section>
                    )
                  })}

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentIndex < affectations.length - 1) {
                          navigateToCollaborator(currentIndex + 1)
                        } else {
                          handleSubmitAll()
                        }
                      }}
                      disabled={!isCurrentAffCompleted}
                      className="px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-md shadow-slate-900/10 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                    >
                      <span>Valider pour {currentEvalue.evalue.prenom} {currentEvalue.evalue.nom}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Sélectionnez un collaborateur pour débuter l'évaluation.
            </div>
          )}
        </main>
      </div>

      {/* ── MODALE D'ERREUR DE VALIDATION / COMPLÉTUDE ── */}
      {validationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Évaluation incomplète</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
              {validationError}
            </p>
            <button
              onClick={() => setValidationError(null)}
              className="w-full px-4 py-2.5 bg-[#002B49] text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-[#001829] transition-colors"
            >
              Compris, compléter la note
            </button>
          </div>
        </div>
      )}

      {/* ── MODALE DE CONFIRMATION DE SOUMISSION DÉFINITIVE & IRRÉVERSIBLE ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#002B49] text-[#D4AF37] flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#002B49]">Clôture définitive de la campagne</h3>
                  <p className="text-xs text-slate-500">Direction des Solutions Maritimes</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed mb-6 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                Action irréversible et finale
              </p>
              <p>
                Vous confirmez avoir noté l'ensemble des <strong>{affectations.length} collaborateurs</strong> qui vous sont attribués. Une fois la soumission envoyée, vos notes seront scellées dans la base de données.
              </p>
              <p className="text-[11px] text-amber-800 font-medium">
                Pondération DSM TAMIS : vos évaluations sont converties directement sur <strong>{isManager ? '55 points' : '45 points'}</strong> quel que soit le nombre de critères soumis.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Annuler et relire
              </button>
              <button
                onClick={executeSubmit}
                disabled={submitting}
                className="px-5 py-2.5 text-xs font-bold text-[#002B49] bg-gradient-to-r from-[#D4AF37] to-[#c59d24] hover:brightness-105 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin text-[#002B49]" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmer la soumission finale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST RETOUR RAPIDE (FEEDBACK & TRANSITIONS) ── */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-3 animate-fade-in ${
          feedback.type === 'success'
            ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
            : 'bg-rose-950 text-rose-100 border-rose-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="flex-1">{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="text-white/50 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── TOAST NOTIFICATION PASSAGE COLLABORATEUR ── */}
      {transitionToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#002B49] text-white p-4 rounded-xl shadow-xl border border-white/10 flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-white mb-0.5">Notation enregistrée</p>
            <p className="text-white/70">
              {transitionToast.prevNom} a été évalué avec succès.
            </p>
            {transitionToast.nextNom && (
              <p className="text-[#D4AF37] font-semibold mt-1.5 flex items-center gap-1">
                Passage à {transitionToast.nextNom} <ChevronRight className="w-3.5 h-3.5" />
              </p>
            )}
            {transitionToast.isFinal && (
              <p className="text-emerald-300 font-semibold mt-1.5">
                Toutes les évaluations sont complétées ! Vous pouvez clôturer.
              </p>
            )}
          </div>
          <button onClick={() => setTransitionToast(null)} className="text-white/40 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  )
}
