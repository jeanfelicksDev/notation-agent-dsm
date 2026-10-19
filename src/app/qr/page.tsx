'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, CircleCheck, Loader2, Star } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'

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

type Etape = 'identification' | 'agents' | 'formulaire' | 'merci'

const LIBELLES_ETOILES = ['Très insatisfait', 'Insatisfait', 'Correct', 'Satisfait', 'Très satisfait']

export default function PortailClient() {
  const [etape, setEtape] = useState<Etape>('identification')
  const [telephone, setTelephone] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [indisponible, setIndisponible] = useState<string | null>(null)

  const [client, setClient] = useState<{ id: string; nom: string; prenom: string } | null>(null)
  const [campagne, setCampagne] = useState('')
  const [agents, setAgents] = useState<Agent[]>([])
  const [criteres, setCriteres] = useState<Critere[]>([])

  const [agent, setAgent] = useState<Agent | null>(null)
  const [notes, setNotes] = useState<Record<string, number>>({})
  const [commentaire, setCommentaire] = useState('')

  useEffect(() => {
    fetch('/api/qr/criteres')
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        if (!ok) return setIndisponible(data.error || 'Le questionnaire est indisponible pour le moment.')
        setCriteres(data.campagne.criteres)
        setCampagne(data.campagne.libelle)
      })
      .catch(() => setIndisponible('Connexion impossible. Vérifiez votre réseau puis rechargez la page.'))
  }, [])

  const verifier = async (silencieux = false) => {
    if (!silencieux) {
      setErreur('')
      setChargement(true)
    }
    try {
      const res = await fetch('/api/qr/verify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telephone }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (!silencieux) setErreur(data.error || 'Numéro non reconnu.')
        return
      }
      setClient(data.client)
      setAgents(data.agents ?? [])
      if (!silencieux) setEtape('agents')
    } catch {
      if (!silencieux) setErreur('Connexion impossible. Réessayez dans un instant.')
    } finally {
      setChargement(false)
    }
  }

  const ouvrir = (a: Agent) => {
    if (a.hasRated) return
    setAgent(a)
    setNotes({})
    setCommentaire('')
    setErreur('')
    setEtape('formulaire')
    window.scrollTo({ top: 0 })
  }

  const complet = criteres.length > 0 && criteres.every((c) => (notes[c.id] ?? 0) > 0)

  const envoyer = async () => {
    if (!complet || !agent || !client) return
    setChargement(true)
    setErreur('')
    try {
      const res = await fetch('/api/qr/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          agentId: agent.id,
          // Le commentaire général est rattaché au premier critère (une seule fois).
          notes: criteres.map((c, i) => ({ critereId: c.id, valeur: notes[c.id], commentaire: i === 0 ? commentaire : '' })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErreur(data.error || 'L’envoi a échoué.')
        return
      }
      await verifier(true)
      setEtape('merci')
    } catch {
      setErreur('Connexion impossible. Votre avis n’a pas été envoyé : réessayez.')
    } finally {
      setChargement(false)
    }
  }

  const restants = agents.filter((a) => !a.hasRated)

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-navy-900 text-white">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-5">
          <BrandMark size={28} />
          <span className="text-[15px] font-semibold">
            DSM <span className="text-gold-500">TAMIS</span>
          </span>
          {campagne && <span className="ml-auto truncate text-xs text-navy-200">{campagne}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6 sm:px-5 sm:py-10">
        {indisponible ? (
          <Carte>
            <AlertCircle className="h-6 w-6 text-gold-700" aria-hidden />
            <h1 className="mt-4 text-xl font-semibold text-navy-900">Questionnaire indisponible</h1>
            <p className="mt-2 text-[15px] text-slate-600">{indisponible}</p>
          </Carte>
        ) : etape === 'identification' ? (
          <Carte>
            <h1 className="text-xl font-semibold tracking-tight text-navy-900">Votre avis sur nos agents</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              Saisissez le numéro de téléphone enregistré par la DSM pour retrouver les agents qui vous ont accompagné.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                verifier()
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label htmlFor="tel" className="mb-1.5 block text-sm font-medium text-slate-800">
                  Numéro de téléphone
                </label>
                <input
                  id="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base outline-none focus:border-navy-600 focus:ring-3 focus:ring-navy-600/15"
                />
              </div>
              {erreur && <Erreur>{erreur}</Erreur>}
              <button type="submit" disabled={chargement || !telephone.trim()} className={BTN}>
                {chargement ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden /> : 'Continuer'}
              </button>
            </form>
          </Carte>
        ) : etape === 'agents' ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-navy-900">Bonjour {client?.prenom} {client?.nom}</h1>
            <p className="mt-1 text-[15px] text-slate-600">
              {restants.length > 0
                ? `Choisissez l’agent à évaluer (${restants.length} restant${restants.length > 1 ? 's' : ''}).`
                : 'Vous avez donné votre avis sur tous les agents. Merci !'}
            </p>
            {agents.length === 0 ? (
              <Carte className="mt-5">
                <p className="text-[15px] text-slate-600">Aucun agent n’est ouvert à l’évaluation pour vous en ce moment.</p>
              </Carte>
            ) : (
              <ul className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card">
                {agents.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => ouvrir(a)}
                      disabled={a.hasRated}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-navy-50 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          a.hasRated ? 'bg-emerald-50 text-emerald-700' : 'bg-navy-900 text-white'
                        }`}
                      >
                        {a.hasRated ? <Check className="h-4.5 w-4.5" aria-hidden /> : `${a.prenom[0] ?? ''}${a.nom[0] ?? ''}`}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">
                          {a.prenom} {a.nom}
                        </span>
                        <span className="block truncate text-sm text-slate-500">{[a.service, a.site].filter(Boolean).join(' · ') || 'DSM'}</span>
                      </span>
                      <span className={`shrink-0 text-sm ${a.hasRated ? 'text-emerald-700' : 'font-medium text-navy-800'}`}>
                        {a.hasRated ? 'Avis donné' : 'Évaluer'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : etape === 'formulaire' && agent ? (
          <>
            <button
              onClick={() => setEtape('agents')}
              className="-ml-2 mb-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Liste des agents
            </button>
            <Carte>
              <p className="text-sm text-slate-500">Votre avis sur</p>
              <h1 className="text-xl font-semibold tracking-tight text-navy-900">
                {agent.prenom} {agent.nom}
              </h1>
              {agent.service && <p className="text-sm text-slate-600">{agent.service}</p>}

              <div className="mt-6 space-y-6">
                {criteres.map((c) => (
                  <Etoiles key={c.id} critere={c} valeur={notes[c.id] ?? 0} onChange={(v) => setNotes((n) => ({ ...n, [c.id]: v }))} />
                ))}
              </div>

              <div className="mt-6">
                <label htmlFor="com" className="flex items-baseline justify-between text-sm font-medium text-slate-800">
                  Un commentaire ? <span className="text-xs font-normal text-slate-400">facultatif</span>
                </label>
                <textarea
                  id="com"
                  rows={3}
                  maxLength={1000}
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-navy-600 focus:ring-3 focus:ring-navy-600/15"
                />
              </div>

              {erreur && (
                <div className="mt-4">
                  <Erreur>{erreur}</Erreur>
                </div>
              )}

              <button onClick={envoyer} disabled={!complet || chargement} className={`${BTN} mt-6`}>
                {chargement ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden /> : 'Envoyer mon avis'}
              </button>
              {!complet && <p className="mt-2 text-center text-sm text-slate-500">Notez chaque critère pour envoyer votre avis.</p>}
            </Carte>
          </>
        ) : (
          <Carte className="text-center">
            <CircleCheck className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
            <h1 className="mt-4 text-xl font-semibold text-navy-900">Merci pour votre avis</h1>
            <p className="mt-2 text-[15px] text-slate-600">
              Il a bien été transmis{agent ? ` pour ${agent.prenom} ${agent.nom}` : ''}.
            </p>
            {restants.length > 0 && (
              <button onClick={() => setEtape('agents')} className={`${BTN} mt-6`}>
                Évaluer un autre agent
              </button>
            )}
          </Carte>
        )}
      </main>
    </div>
  )
}

const BTN =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40'

function Carte({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`animate-rise-in rounded-[var(--radius-card)] bg-white p-6 shadow-card sm:p-8 ${className}`}>{children}</section>
}

function Erreur({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex gap-2 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
      {children}
    </p>
  )
}

function Etoiles({ critere, valeur, onChange }: { critere: Critere; valeur: number; onChange: (v: number) => void }) {
  const [survol, setSurvol] = useState(0)
  const affiche = survol || valeur
  const echelle = Array.from({ length: critere.noteMaximale }, (_, i) => i + 1)
  const libelle = critere.noteMaximale === 5 && affiche ? LIBELLES_ETOILES[affiche - 1] : affiche ? `${affiche} / ${critere.noteMaximale}` : ''

  return (
    <fieldset>
      <legend className="text-[15px] font-medium text-slate-900">{critere.libelle}</legend>
      {critere.description && <p className="mt-0.5 text-sm text-slate-500">{critere.description}</p>}
      <div className="mt-2 flex items-center gap-3" onMouseLeave={() => setSurvol(0)}>
        <div className="flex" role="radiogroup" aria-label={critere.libelle}>
          {echelle.map((n) => (
            <label key={n} className="cursor-pointer p-1 has-[:focus-visible]:rounded has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy-600" onMouseEnter={() => setSurvol(n)}>
              <input type="radio" name={critere.id} value={n} checked={valeur === n} onChange={() => onChange(n)} className="sr-only" />
              <span className="sr-only">
                {n} sur {critere.noteMaximale}
              </span>
              <Star
                className={`h-8 w-8 transition-colors ${n <= affiche ? 'fill-gold-500 text-gold-500' : 'fill-transparent text-slate-300'}`}
                strokeWidth={1.5}
                aria-hidden
              />
            </label>
          ))}
        </div>
        <span className="text-sm text-slate-600" aria-hidden>
          {libelle}
        </span>
      </div>
    </fieldset>
  )
}
