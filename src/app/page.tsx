'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, Loader2 } from 'lucide-react'
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

/** Jours restants jusqu'à la fin du dernier jour de la campagne (0 = dernier jour). */
function joursRestants(iso: string) {
  const fin = new Date(iso)
  fin.setHours(23, 59, 59, 999)
  return Math.max(0, Math.floor((fin.getTime() - Date.now()) / 86_400_000))
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
    connexion: estAdmin ? 'Votre mot de passe' : 'Votre PIN',
    definir: 'Choisissez votre PIN',
    contact_admin: 'Compte à activer',
  }[etape]
  const jours = campagne ? joursRestants(campagne.dateFin) : null

  return (
    <div className="relative min-h-dvh overflow-hidden bg-navy-900 text-white">
      <Isobathes />

      <div className="relative mx-auto grid min-h-dvh max-w-[90rem] grid-rows-[auto_1fr_auto] px-5 sm:px-10 lg:px-16">
        {/* ─── En-tête ─── */}
        <header className="flex items-center justify-between gap-4 py-6 lg:py-8">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-tight">
                DSM <span className="text-gold-500">TAMIS</span>
              </p>
              <p className="hidden text-xs text-navy-200 sm:block">Direction des Solutions Maritimes</p>
            </div>
          </div>
          <a
            href="/qr"
            className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-navy-100 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white"
          >
            Vous êtes client ?<span className="hidden sm:inline"> Donnez votre avis</span>
            <ArrowUpRight className="h-4 w-4 text-gold-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </a>
        </header>

        {/* ─── Scène ─── */}
        <main className="grid items-center gap-10 py-6 lg:grid-cols-12 lg:gap-16 lg:py-10">
          <section className="lg:col-span-7" aria-labelledby="titre-campagne">
            <div className="relative flex max-w-full flex-col items-start sm:inline-block">
              <h1
                id="titre-campagne"
                className="animate-reveal font-display text-[clamp(2.6rem,8.5vw,8.25rem)] leading-[0.86] font-extrabold tracking-[-0.01em] text-balance uppercase"
              >
                {campagne ? campagne.libelle : 'Évaluation des agents'}
              </h1>
              {jours !== null && (
                <p
                  className="order-first mb-4 inline-block rotate-[-4deg] rounded-sm border-2 border-gold-500 px-3 py-1 font-stencil text-lg leading-none text-gold-400 sm:absolute sm:-top-7 sm:right-0 sm:mb-0 sm:rotate-[-6deg] sm:text-2xl lg:-right-6"
                  aria-label={jours === 0 ? 'Dernier jour de la campagne' : `Clôture dans ${jours} jours`}
                >
                  {jours === 0 ? 'DERNIER JOUR' : `CLÔTURE J-${jours}`}
                </p>
              )}
            </div>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-navy-100 sm:mt-8 sm:text-xl">
              Notez les collaborateurs qui vous sont attribués, critère par critère.
              {campagne && (
                <>
                  {' '}
                  La campagne se termine le <strong className="font-semibold text-white">{formatDate(campagne.dateFin)}</strong>.
                </>
              )}
            </p>

            {campagne && (
              <div className="mt-10 hidden max-w-md sm:block">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-navy-200">Évaluations déjà soumises</span>
                  <span className="font-display text-3xl leading-none font-bold text-white tabular-nums">
                    {campagne.completionRate}
                    <span className="ml-0.5 text-lg text-gold-400">%</span>
                  </span>
                </div>
                <div
                  className="mt-3 grid h-2 grid-cols-20 gap-[3px]"
                  role="progressbar"
                  aria-valuenow={campagne.completionRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Évaluations déjà soumises"
                >
                  {Array.from({ length: 20 }, (_, i) => (
                    <span
                      key={i}
                      className={`rounded-[1px] ${i < Math.round(campagne.completionRate / 5) ? 'bg-gold-500' : 'bg-white/12'}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ─── Formulaire ─── */}
          <section className="lg:col-span-5" aria-labelledby="titre-connexion">
            <div className="relative rounded-xl bg-white p-7 text-slate-900 shadow-overlay sm:p-10">
              <Reperes />

              {etape !== 'identifiant' && (
                <button
                  type="button"
                  onClick={retour}
                  className="-ml-2 mb-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Changer d’identifiant
                </button>
              )}

              <h2 id="titre-connexion" className="font-display text-4xl leading-none font-bold tracking-tight text-navy-900 uppercase">
                {titre}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                {etape === 'identifiant' && 'Votre matricule ou votre numéro de téléphone.'}
                {etape === 'connexion' && (
                  <>
                    Compte <strong className="font-semibold text-slate-900">{identifiant}</strong>
                    {champPin ? ' · le PIN à 4 chiffres que vous avez choisi.' : '.'}
                  </>
                )}
                {etape === 'definir' && (
                  <>
                    Première connexion pour <strong className="font-semibold text-slate-900">{identifiant}</strong>. Ce PIN vous servira à
                    chaque connexion ; seul un administrateur pourra le réinitialiser.
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
                    <Champ label={etape === 'definir' ? 'Nouveau PIN (4 chiffres)' : champPin ? 'PIN' : 'Mot de passe'} htmlFor="secret">
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
                          className={`${INPUT} pr-12 ${champPin ? 'font-display text-2xl tracking-[0.6em] tabular-nums' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setVoirSecret((v) => !v)}
                          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800"
                          aria-label={voirSecret ? 'Masquer' : 'Afficher'}
                        >
                          {voirSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                        className={`${INPUT} font-display text-2xl tracking-[0.6em] tabular-nums`}
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
                    className="group flex h-14 w-full items-center justify-between rounded-lg bg-navy-900 px-5 text-base font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-60"
                  >
                    <span>{etape === 'identifiant' ? 'Continuer' : etape === 'definir' ? 'Enregistrer mon PIN' : 'Se connecter'}</span>
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500 text-navy-950 transition-transform group-hover:translate-x-1">
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </span>
                    )}
                  </button>

                  {etape === 'connexion' && champPin && (
                    <p className="text-sm text-slate-500">PIN oublié ? Demandez une réinitialisation à votre administrateur.</p>
                  )}
                </form>
              )}
            </div>
          </section>
        </main>

        {/* ─── Pied ─── */}
        <footer className="flex flex-col gap-4 border-t border-white/10 py-6 text-sm text-navy-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden items-center gap-4 sm:flex">
            <div className="rounded-md bg-white p-1.5">
              <QRCode value={typeof window !== 'undefined' ? `${window.location.origin}/` : '/'} size={52} level="M" fgColor="#002B49" />
            </div>
            <p className="max-w-[15rem] leading-snug">Sur votre téléphone ? Scannez pour ouvrir la plateforme.</p>
          </div>
          <p>Direction des Solutions Maritimes · plateforme interne</p>
        </footer>
      </div>
    </div>
  )
}

const INPUT =
  'block h-14 w-full rounded-lg border border-slate-300 bg-white px-4 text-lg text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-navy-700 focus:ring-4 focus:ring-navy-700/12 disabled:bg-slate-50'

function Champ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
    </div>
  )
}

/** Repères de coupe dorés aux angles, comme sur une étiquette d'expédition. */
function Reperes() {
  const angle = 'pointer-events-none absolute h-5 w-5 border-gold-500'
  return (
    <>
      <span aria-hidden className={`${angle} -top-2 -left-2 border-t-2 border-l-2`} />
      <span aria-hidden className={`${angle} -top-2 -right-2 border-t-2 border-r-2`} />
      <span aria-hidden className={`${angle} -bottom-2 -left-2 border-b-2 border-l-2`} />
      <span aria-hidden className={`${angle} -right-2 -bottom-2 border-r-2 border-b-2`} />
    </>
  )
}

/** Isobathes : lignes de profondeur d'une carte marine, en filigrane du fond navy. */
function Isobathes() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.05]"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
    >
      {Array.from({ length: 14 }, (_, i) => {
        const r = 120 + i * 70
        return (
          <path
            key={i}
            d={`M ${-40} ${900 - r * 0.2} C ${r * 0.9} ${900 - r * 1.15}, ${720 + r * 0.25} ${620 - r * 0.55}, 1480 ${560 - r * 0.62}`}
          />
        )
      })}
    </svg>
  )
}
