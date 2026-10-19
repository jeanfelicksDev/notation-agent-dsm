'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Smartphone } from 'lucide-react'
import { destinationPourRole } from '@/lib/roles'
import { BrandMark } from '@/components/BrandMark'

const QRCode = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })

type Etape = 'identifiant' | 'connexion' | 'definir' | 'contact_admin'

type CampagnePublique = { libelle: string; dateFin: string; completionRate: number } | null

const MESSAGES_REDIRECTION: Record<string, string> = {
  admin_required: 'Cet espace est réservé aux administrateurs. Connectez-vous avec un compte administrateur.',
  auth_required: 'Connectez-vous pour continuer.',
  session_expired: 'Votre session a expiré. Connectez-vous à nouveau.',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Accueil() {
  return (
    <Suspense>
      <AccueilContenu />
    </Suspense>
  )
}

function AccueilContenu() {
  const reason = useSearchParams().get('reason')
  const [etape, setEtape] = useState<Etape>('identifiant')
  const [identifiant, setIdentifiant] = useState('')
  const [secret, setSecret] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [estAdmin, setEstAdmin] = useState(false)
  const [voirSecret, setVoirSecret] = useState(false)
  const [error, setError] = useState(() => (reason && MESSAGES_REDIRECTION[reason]) || '')
  const [loading, setLoading] = useState(false)
  const [campagne, setCampagne] = useState<CampagnePublique>(null)
  const secretRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) window.location.href = destinationPourRole(data.user.role)
      })
      .catch(() => {})

    fetch('/api/stats/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCampagne(data?.campagne ?? null))
      .catch(() => {})

    // Le message de redirection est affiché une fois ; on nettoie l'URL.
    if (window.location.search) window.history.replaceState({}, '', '/')
  }, [])

  useEffect(() => {
    if (etape === 'connexion' || etape === 'definir') secretRef.current?.focus()
  }, [etape])

  const retour = () => {
    setEtape('identifiant')
    setSecret('')
    setConfirmation('')
    setError('')
  }

  const post = async (url: string, body: object) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { res, data: await res.json().catch(() => ({})) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (etape === 'identifiant') {
        const { res, data } = await post('/api/auth/identifier', { identifiant })
        if (!res.ok) return setError(data.error || 'Identifiant inconnu.')
        setEstAdmin(Boolean(data.admin))
        setEtape(data.etat === 'pin_a_definir' ? 'definir' : data.etat === 'contact_admin' ? 'contact_admin' : 'connexion')
        return
      }

      if (etape === 'definir') {
        if (!/^\d{4}$/.test(secret)) return setError('Le PIN doit comporter exactement 4 chiffres.')
        if (secret !== confirmation) return setError('Les deux PIN ne correspondent pas.')
        const { res, data } = await post('/api/auth/definir-pin', { identifiant, pin: secret, confirmation })
        if (!res.ok) {
          if (res.status === 409) setEtape('connexion')
          return setError(data.error || 'Impossible d’enregistrer ce PIN.')
        }
        window.location.href = destinationPourRole(data.role)
        return
      }

      if (etape === 'connexion') {
        const { res, data } = await post('/api/auth/login', { identifiant, password: secret })
        if (!res.ok) {
          setSecret('')
          return setError(data.error || 'Identifiant ou PIN incorrect.')
        }
        window.location.href = destinationPourRole(data.role)
      }
    } catch {
      setError('Le serveur ne répond pas. Vérifiez votre connexion et réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const champPin = !estAdmin
  const titre = {
    identifiant: 'Connexion',
    connexion: 'Saisissez votre PIN',
    definir: 'Choisissez votre PIN',
    contact_admin: 'Compte à activer',
  }[etape]

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* ─── Panneau de marque ─── */}
      <aside className="relative flex flex-col justify-between gap-10 overflow-hidden bg-navy-900 px-6 py-8 text-white sm:px-10 lg:w-[46%] lg:px-14 lg:py-12">
        <ChartLines />

        <div className="relative flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">
              DSM <span className="text-gold-500">TAMIS</span>
            </p>
            <p className="text-xs text-navy-200">Direction des Solutions Maritimes</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            Évaluation de la performance des agents
          </h1>
          {campagne ? (
            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-lg font-medium text-gold-400">{campagne.libelle}</p>
              <p className="mt-1 text-sm text-navy-200">
                Ouverte jusqu’au {formatDate(campagne.dateFin)}
              </p>
              <div className="mt-5 max-w-xs">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-navy-100">Évaluations soumises</span>
                  <span className="font-semibold tabular-nums">{campagne.completionRate} %</span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuenow={campagne.completionRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Évaluations soumises"
                >
                  <div className="h-full rounded-full bg-gold-500" style={{ width: `${campagne.completionRate}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-base text-navy-200">Aucune campagne d’évaluation n’est ouverte pour le moment.</p>
          )}
        </div>

        <div className="relative hidden items-center gap-4 lg:flex">
          <div className="h-20 w-20 rounded-lg bg-white p-2">
            <QRCode value={typeof window !== 'undefined' ? `${window.location.origin}/` : '/'} size={64} level="M" fgColor="#002B49" />
          </div>
          <p className="max-w-[16rem] text-sm text-navy-200">
            <Smartphone className="mr-1.5 inline h-4 w-4 text-gold-500" aria-hidden />
            Scannez pour ouvrir la plateforme sur votre téléphone.
          </p>
        </div>
      </aside>

      {/* ─── Formulaire ─── */}
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          {etape !== 'identifiant' && (
            <button
              type="button"
              onClick={retour}
              className="-ml-2 mb-6 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Changer d’identifiant
            </button>
          )}

          <h2 className="text-2xl font-semibold tracking-tight text-navy-900">{titre}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {etape === 'identifiant' && 'Saisissez votre matricule ou votre numéro de téléphone.'}
            {etape === 'connexion' &&
              (estAdmin ? (
                <>Compte administrateur <strong className="font-medium text-slate-900">{identifiant}</strong>.</>
              ) : (
                <>Compte <strong className="font-medium text-slate-900">{identifiant}</strong>. Saisissez le PIN à 4 chiffres que vous avez choisi.</>
              ))}
            {etape === 'definir' && (
              <>
                Première connexion pour <strong className="font-medium text-slate-900">{identifiant}</strong>. Ce PIN vous
                servira à chaque connexion ; seul un administrateur pourra le réinitialiser.
              </>
            )}
            {etape === 'contact_admin' &&
              'Ce compte administrateur n’a pas encore de mot de passe. Il doit être initialisé par la commande d’installation.'}
          </p>

          {etape !== 'contact_admin' && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              {etape === 'identifiant' && (
                <Champ label="Matricule ou téléphone" htmlFor="identifiant">
                  <input
                    id="identifiant"
                    value={identifiant}
                    onChange={(e) => setIdentifiant(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoFocus
                    required
                    disabled={loading}
                    className={INPUT}
                  />
                </Champ>
              )}

              {(etape === 'connexion' || etape === 'definir') && (
                <Champ
                  label={etape === 'definir' ? 'Nouveau PIN (4 chiffres)' : champPin ? 'PIN' : 'Mot de passe'}
                  htmlFor="secret"
                >
                  <div className="relative">
                    <input
                      ref={secretRef}
                      id="secret"
                      type={voirSecret ? 'text' : 'password'}
                      value={secret}
                      onChange={(e) => setSecret(champPin ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)}
                      inputMode={champPin ? 'numeric' : undefined}
                      maxLength={champPin ? 4 : undefined}
                      autoComplete={etape === 'definir' ? 'new-password' : 'current-password'}
                      required
                      disabled={loading}
                      className={`${INPUT} pr-11 ${champPin ? 'tracking-[0.5em] tabular-nums' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setVoirSecret((v) => !v)}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800"
                      aria-label={voirSecret ? 'Masquer' : 'Afficher'}
                    >
                      {voirSecret ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </Champ>
              )}

              {etape === 'definir' && (
                <Champ label="Confirmez le PIN" htmlFor="confirmation">
                  <input
                    id="confirmation"
                    type={voirSecret ? 'text' : 'password'}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="new-password"
                    required
                    disabled={loading}
                    className={`${INPUT} tracking-[0.5em] tabular-nums`}
                  />
                </Champ>
              )}

              {error && (
                <p role="alert" className="flex gap-2 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-3 text-[15px] font-semibold text-white shadow-raised transition-colors hover:bg-navy-800 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
                ) : (
                  <>
                    {etape === 'identifiant' ? 'Continuer' : etape === 'definir' ? 'Enregistrer mon PIN' : 'Se connecter'}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>

              {etape === 'connexion' && champPin && (
                <p className="text-center text-sm text-slate-500">
                  PIN oublié ? Demandez une réinitialisation à votre administrateur.
                </p>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

const INPUT =
  'block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-navy-600 focus:ring-3 focus:ring-navy-600/15 disabled:bg-slate-50'

function Champ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
    </div>
  )
}

/** Isobathes : lignes de profondeur d'une carte marine, en filigrane du panneau navy. */
function ChartLines() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute -right-24 -bottom-24 h-[130%] w-[130%] text-white/[0.045]"
      viewBox="0 0 600 600"
      preserveAspectRatio="xMaxYMax slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      {Array.from({ length: 9 }, (_, i) => {
        const r = 90 + i * 52
        return (
          <path
            key={i}
            d={`M ${600 - r} 600 C ${600 - r} ${600 - r * 0.62}, ${600 - r * 0.58} ${600 - r * 1.04}, 600 ${600 - r * 1.08}`}
          />
        )
      })}
    </svg>
  )
}
