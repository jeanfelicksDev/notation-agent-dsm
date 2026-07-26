'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Award,
  LogOut,
  Save,
  Send,
  ChevronLeft,
  Check,
  Star,
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
  const [notes, setNotes] = useState<NotesMap>({})
  const [loading, setLoading] = useState(true)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)

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
        router.push('/')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur de chargement')
        return
      }
      setEvaluateur(data.evaluateur)
      setCampagne(data.campagne)
      setCriteres(data.criteres)
      setAffectations(data.affectations)
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
    router.push('/')
  }

  const handleNoteChange = (evalueId: string, critereId: string, valeur: number) => {
    setNotes((prev) => ({
      ...prev,
      [evalueId]: {
        ...prev[evalueId],
        [critereId]: {
          valeur,
          commentaire: prev[evalueId]?.[critereId]?.commentaire || '',
        },
      },
    }))
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

  const handleSubmitAll = async () => {
    // Toutes les notes doivent être > 0 pour tous les critères de tous les évalués
    for (const aff of affectations) {
      for (const crit of criteres) {
        const val = notes[aff.evalueId]?.[crit.id]?.valeur || 0
        if (val === 0) {
          const idx = affectations.findIndex((a) => a.id === aff.id)
          setCurrentIndex(idx)
          setFeedback({
            type: 'error',
            msg: `Critère "${crit.libelle}" manquant pour ${aff.evalue.prenom} ${aff.evalue.nom}`,
          })
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const allNotes = Object.entries(notes).flatMap(([evalueId, evalueNotes]) =>
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
        setFeedback({ type: 'error', msg: data.error || 'Échec de la soumission' })
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
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md">
          <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Évaluations soumises</h2>
          <p className="text-slate-600 mb-8">
            Merci, vos notes ont été enregistrées et verrouillées.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogout}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-xl"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">
            Impossible de charger
          </h2>
          <p className="text-slate-600 text-center mb-6">{error}</p>
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 premium-gradient rounded-xl flex items-center justify-center shadow-md shadow-brand-200 flex-shrink-0">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                {isManager ? 'Évaluation Manager' : 'Évaluation 360°'}
              </p>
              <p className="font-bold text-slate-800 truncate">
                {evaluateur?.prenom} {evaluateur?.nom}
                {evaluateur?.service && (
                  <span className="font-medium text-slate-400 ml-1">· {evaluateur.service}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
            <span>
              {completionCount} / {affectations.length} collègue
              {affectations.length > 1 ? 's' : ''} noté{completionCount > 1 ? 's' : ''}
            </span>
            {campagne && (
              <span className="text-slate-400">
                Pondération : collègues {campagne.poidsCollegues} / manager {campagne.poidsManager}
              </span>
            )}
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full premium-gradient transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Feedback */}
      {feedback && (
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-3">
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {/* Current colleague card */}
        {currentEvalue && (
          <>
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-4 relative overflow-hidden">
              <div className="absolute top-4 right-6 font-black bg-brand-50 text-brand-600 px-3 py-1.5 rounded-xl text-sm">
                {currentIndex + 1} / {affectations.length}
              </div>

              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                  <User className="w-8 h-8 text-brand-600" />
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    Notation de
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                    {currentEvalue.evalue.prenom} {currentEvalue.evalue.nom}
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-slate-600 text-xs bg-slate-100 px-3 py-1 rounded-full font-semibold">
                      {currentEvalue.evalue.service || 'Service N/A'}
                    </span>
                    {currentEvalue.statut === 'TERMINEE' && (
                      <span className="text-emerald-700 text-xs bg-emerald-50 px-3 py-1 rounded-full font-bold">
                        Verrouillé
                      </span>
                    )}
                    {currentEvalue.statut === 'BROUILLON' && (
                      <span className="text-amber-700 text-xs bg-amber-50 px-3 py-1 rounded-full font-bold">
                        Brouillon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Criteria */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-6">
              <div className="space-y-8">
                {criteres.map((critere, critIdx) => {
                  const noteValue =
                    notes[currentEvalue.evalueId]?.[critere.id]?.valeur || 0
                  const options = getAppreciationOptions(critere.noteMaximale)
                  const selectedOpt = options.find((o) => o.note === noteValue)

                  return (
                    <div
                      key={critere.id}
                      className="border-b border-slate-100 pb-7 last:border-0 last:pb-0 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-600 text-xs font-black flex items-center justify-center">
                              {critIdx + 1}
                            </span>
                            <h4 className="font-bold text-slate-900 text-base">{critere.libelle}</h4>
                          </div>
                          {critere.description && (
                            <p className="text-xs text-slate-500 font-medium ml-8">
                              {critere.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-black text-slate-700">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            {noteValue > 0 ? `${noteValue} / ${critere.noteMaximale} pts` : `Échelle sur ${critere.noteMaximale} pts`}
                          </span>
                        </div>
                      </div>

                      {/* Appreciations Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {options.map((opt) => {
                          const isSelected = noteValue === opt.note
                          return (
                            <button
                              key={opt.note}
                              type="button"
                              disabled={currentEvalue.statut === 'TERMINEE'}
                              onClick={() =>
                                handleNoteChange(currentEvalue.evalueId, critere.id, opt.note)
                              }
                              className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'border-brand-500 bg-brand-50/70 shadow-md shadow-brand-100/50 ring-2 ring-brand-200'
                                  : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected
                                      ? 'bg-brand-500 text-white shadow-sm'
                                      : 'bg-white border border-slate-200 text-slate-700'
                                  }`}
                                >
                                  {opt.note}
                                </span>
                                <div className="min-w-0">
                                  <span
                                    className={`text-xs sm:text-sm font-bold block truncate ${
                                      isSelected ? 'text-brand-950 font-black' : 'text-slate-800'
                                    }`}
                                  >
                                    {opt.appreciation}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-medium block truncate">
                                    {opt.description}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center">
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

                      {/* Comment Area */}
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
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-xs sm:text-sm resize-none focus:ring-4 focus:ring-brand-100 focus:border-brand-400 outline-none disabled:bg-slate-50 bg-slate-50/30"
                          rows={2}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Subtotal */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Total provisoire
                </span>
                <span className="text-2xl font-black text-slate-800">
                  {currentScoreSubtotal} <span className="text-slate-300">/ {maxSubtotal}</span>
                </span>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSave}
                  disabled={savingDraft || currentEvalue.statut === 'TERMINEE'}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  {savingDraft ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700" />
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Sauvegarder le brouillon
                    </>
                  )}
                </button>
                <button
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  disabled={currentIndex === affectations.length - 1}
                  className="flex-1 premium-gradient hover:shadow-xl hover:shadow-brand-200 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Prev / Submit row */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 text-brand-600 hover:text-brand-700 disabled:text-slate-300 disabled:cursor-not-allowed font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
              {currentIndex === affectations.length - 1 && (
                <button
                  onClick={handleSubmitAll}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 px-6 sm:px-8 rounded-xl shadow-lg shadow-emerald-200 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Soumettre tout
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
