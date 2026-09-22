'use client'

import { useEffect, useState } from 'react'
import {
  Star,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Anchor,
  User,
  ArrowLeft,
  Check,
} from 'lucide-react'

interface Critere {
  id: string
  libelle: string
  description: string | null
  noteMaximale: number
}

interface Agent {
  id: string
  nom: string
  prenom: string
  service: string | null
  site: string | null
  hasRated: boolean
}

type Stage = 'verify-client' | 'dashboard' | 'form' | 'submitting' | 'done' | 'error'

export default function GlobalQrPage() {
  const [stage, setStage] = useState<Stage>('verify-client')
  const [telephone, setTelephone] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState('')

  // Session states
  const [clientId, setClientId] = useState<string>('')
  const [clientName, setClientName] = useState('')
  const [campagneLibelle, setCampagneLibelle] = useState('')
  const [campagneId, setCampagneId] = useState('')
  const [agents, setAgents] = useState<Agent[]>([])

  // Selection & evaluation states
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [criteres, setCriteres] = useState<Critere[]>([])
  const [notes, setNotes] = useState<Record<string, number>>({})
  const [commentaire, setCommentaire] = useState('')
  const [hovered, setHovered] = useState<Record<string, number>>({})
  const [submittingError, setSubmittingError] = useState('')

  // Load criteria of the active campaign once
  useEffect(() => {
    fetch('/api/qr/criteres')
      .then((r) => r.json())
      .then((data) => {
        if (data.campagne) {
          setCriteres(data.campagne.criteres)
          setCampagneId(data.campagne.id)
          setCampagneLibelle(data.campagne.libelle)
        }
      })
      .catch((err) => console.error('Error loading criteria:', err))
  }, [])

  const refreshAgentList = async (phoneToUse?: string) => {
    const activePhone = phoneToUse || telephone
    if (!activePhone) return
    try {
      const res = await fetch('/api/qr/verify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telephone: activePhone.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setAgents(data.agents || [])
      }
    } catch (err) {
      console.error('Error refreshing agents:', err)
    }
  }

  const handleVerifyClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerificationError('')
    if (!telephone.trim()) {
      setVerificationError('Veuillez renseigner votre numéro de téléphone.')
      return
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/qr/verify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telephone: telephone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVerificationError(data.error || 'Vérification échouée')
        return
      }
      setClientId(data.client.id)
      setClientName(`${data.client.prenom} ${data.client.nom}`)
      setAgents(data.agents || [])
      setStage('dashboard')
    } catch {
      setVerificationError('Erreur de connexion au serveur.')
    } finally {
      setVerifying(false)
    }
  }

  const handleSelectAgent = (agent: Agent) => {
    if (agent.hasRated) return
    setSelectedAgent(agent)
    // Init notes at 0 for all criteria
    const init: Record<string, number> = {}
    criteres.forEach((c) => {
      init[c.id] = 0
    })
    setNotes(init)
    setCommentaire('')
    setSubmittingError('')
    setStage('form')
  }

  const allRated = criteres.every((c) => (notes[c.id] ?? 0) > 0)

  const handleSubmitEvaluation = async () => {
    if (!allRated || !selectedAgent || !clientId) return
    setStage('submitting')
    setSubmittingError('')
    const payload = criteres.map((c) => ({
      critereId: c.id,
      valeur: notes[c.id],
      commentaire: commentaire.trim() || undefined,
    }))
    try {
      const res = await fetch('/api/qr/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: payload,
          clientId,
          agentId: selectedAgent.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmittingError(data.error || 'Erreur lors de la soumission')
        setStage('form')
        return
      }
      // Refresh list to update checkmark statuses
      await refreshAgentList()
      setStage('done')
    } catch {
      setSubmittingError('Erreur de connexion au serveur.')
      setStage('form')
    }
  }

  const setNote = (critereId: string, val: number) => {
    setNotes((prev) => ({ ...prev, [critereId]: val }))
  }

  /* ─── STAGE: Verify Client ─── */
  if (stage === 'verify-client') {
    return (
      <div className="qr-page">
        <div className="qr-header">
          <div className="qr-brand-icon">
            <Anchor size={16} color="white" strokeWidth={2.5} />
          </div>
          <span className="qr-brand-name">
            DSM <span className="qr-brand-gold">360°</span>
          </span>
        </div>

        <div className="qr-card">
          <h2 className="qr-status-title text-left mb-2">Authentification Client</h2>
          <p className="text-xs text-slate-500 mb-6">
            Saisissez votre numéro de téléphone ou matricule afin d&apos;accéder aux agents que vous êtes autorisé à
            évaluer.
          </p>

          <form onSubmit={handleVerifyClient} className="space-y-6">
            <div className="qr-comment-group">
              <label className="qr-comment-label">Numéro de téléphone ou Matricule</label>
              <input
                type="text"
                required
                placeholder="Ex : +225 07 00 00 00 ou CLI-001"
                className="qr-comment"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                disabled={verifying}
              />
            </div>

            {verificationError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-xs text-red-700 font-bold animate-fade-in">
                <AlertCircle size={14} />
                <span>{verificationError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || !telephone.trim()}
              className="qr-submit qr-submit-ready"
            >
              {verifying ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Vérification…
                </>
              ) : (
                <>
                  Se connecter <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="qr-footer">Direction des Solutions Maritimes © 2026</p>
      </div>
    )
  }

  /* ─── STAGE: Dashboard (Agent List) ─── */
  if (stage === 'dashboard') {
    return (
      <div className="qr-page">
        <div className="qr-header">
          <div className="qr-brand-icon">
            <Anchor size={16} color="white" strokeWidth={2.5} />
          </div>
          <span className="qr-brand-name">
            DSM <span className="qr-brand-gold">360°</span>
          </span>
        </div>

        <div className="qr-card">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2">
            <div>
              <p className="text-[10px] font-black uppercase text-amber-500 tracking-wider">
                Espace Évaluation
              </p>
              <h2 className="text-lg font-black text-slate-900">
                Bonjour, {clientName}
              </h2>
            </div>
            <button
              onClick={() => {
                setStage('verify-client')
                setTelephone('')
                setClientId('')
                setClientName('')
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Se déconnecter
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Voici la liste des agents DSM que vous êtes autorisé à évaluer lors de la campagne{' '}
            <strong>{campagneLibelle}</strong>.
          </p>

          <div className="space-y-3">
            {agents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold">Aucun agent assigné</p>
                <p className="text-[10px] mt-0.5">
                  Vous n&apos;avez aucun agent disponible à évaluer pour le moment.
                </p>
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => !agent.hasRated && handleSelectAgent(agent)}
                  className={`p-4 border rounded-2xl flex items-center justify-between gap-4 transition-all ${
                    agent.hasRated
                      ? 'bg-slate-50 border-slate-100 cursor-not-allowed opacity-75'
                      : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-sm cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                        agent.hasRated ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {agent.prenom[0]}
                      {agent.nom[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">
                        {agent.prenom} {agent.nom}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {agent.service || 'DSM Maritime'}
                      </p>
                    </div>
                  </div>

                  {agent.hasRated ? (
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                      <Check size={10} strokeWidth={3} /> Évalué
                    </div>
                  ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <p className="qr-footer">Évaluation confidentielle et anonyme</p>
      </div>
    )
  }

  /* ─── STAGE: Survey Form ─── */
  if (stage === 'form' && selectedAgent) {
    const initials = `${selectedAgent.prenom[0]}${selectedAgent.nom[0]}`.toUpperCase()
    return (
      <div className="qr-page">
        <div className="qr-header">
          <button
            onClick={() => setStage('dashboard')}
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={14} /> Retour à la liste
          </button>
        </div>

        <div className="qr-card">
          <div className="qr-agent-hero">
            <div className="qr-agent-avatar">{initials}</div>
            <div>
              <p className="qr-agent-name">
                {selectedAgent.prenom} {selectedAgent.nom}
              </p>
              <p className="qr-agent-service">
                {selectedAgent.service || 'DSM Maritime'}
              </p>
            </div>
          </div>

          <div className="qr-criteres border-t border-slate-100 pt-4">
            {criteres.map((critere) => {
              const current = notes[critere.id] ?? 0
              const hov = hovered[critere.id] ?? 0
              return (
                <div key={critere.id} className="qr-critere">
                  <div className="qr-critere-header"><div className="qr-critere-title"><span className="qr-critere-label">{critere.libelle}</span><span className="qr-critere-counter">
                      {current}/{critere.noteMaximale}
                    </span></div></div>
                  {critere.description && (
                    <p className="qr-critere-desc">{critere.description}</p>
                  )}
                  <div
                    className="qr-stars"
                    onMouseLeave={() => setHovered((h) => ({ ...h, [critere.id]: 0 }))}
                  >
                    {Array.from({ length: critere.noteMaximale }, (_, i) => {
                      const val = i + 1
                      const filled = val <= (hov || current)
                      return (
                        <button
                          key={val}
                          type="button"
                          className={`qr-star${filled ? ' filled' : ''}`}
                          onMouseEnter={() =>
                            setHovered((h) => ({ ...h, [critere.id]: val }))
                          }
                          onClick={() => setNote(critere.id, val)}
                          aria-label={`${val} sur ${critere.noteMaximale}`}
                        >
                          <Star size={28} fill={filled ? 'currentColor' : 'none'} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="qr-comment-group">
            <label className="qr-comment-label">Commentaire (optionnel)</label>
            <textarea
              className="qr-comment"
              rows={3}
              placeholder="Partagez votre expérience avec cet agent…"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </div>

          {submittingError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{submittingError}</span>
            </div>
          )}

          <button
            onClick={handleSubmitEvaluation}
            disabled={!allRated}
            className={`qr-submit${allRated ? ' qr-submit-ready' : ''}`}
          >
            Soumettre l&apos;évaluation
          </button>
        </div>
      </div>
    )
  }

  /* ─── STAGE: Submitting loader ─── */
  if (stage === 'submitting') {
    return (
      <div className="qr-page">
        <div className="qr-card qr-status-card">
          <div className="qr-loader">
            <Loader2 className="qr-spinner" />
            <p className="font-bold text-slate-800 text-sm">Envoi en cours…</p>
            <p className="text-[10px] text-slate-400">Veuillez ne pas quitter cette page.</p>
          </div>
        </div>
      </div>
    )
  }

  /* ─── STAGE: Success Done ─── */
  if (stage === 'done') {
    return (
      <div className="qr-page">
        <div className="qr-card qr-status-card">
          <div className="qr-status-icon qr-status-success">
            <CheckCircle size={36} />
          </div>
          <h2 className="qr-status-title">Évaluation soumise !</h2>
          <p className="qr-status-sub">
            Merci pour votre avis. Vos notes pour{' '}
            <strong>
              {selectedAgent?.prenom} {selectedAgent?.nom}
            </strong>{' '}
            ont bien été enregistrées.
          </p>

          <button
            onClick={() => {
              setSelectedAgent(null)
              setStage('dashboard')
            }}
            className="qr-submit qr-submit-ready mt-4"
          >
            Retourner aux agents
          </button>
        </div>
      </div>
    )
  }

  return null
}
