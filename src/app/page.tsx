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

function formatDateCourte(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Libellé lisible : les mots en capitales passent en casse de titre, les sigles courts (DSM) restent en capitales. */
function libelleCampagne(libelle: string) {
  return libelle
    .split(/\s+/)
    .map((m) => (m.length > 3 && m === m.toUpperCase() ? m.charAt(0) + m.slice(1).toLowerCase() : m))
    .join(' ')
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
  // Collaborateur : matricule ; client externe : téléphone, puis portail d'avis
  const [profil, setProfil] = useState<'collaborateur' | 'client'>('collaborateur')
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
      if (etape === 'identifiant' && profil === 'client') {
        const tel = identifiant.trim()
        if (tel.replace(/\D/g, '').length < 8) return setError('Saisissez votre numéro de téléphone complet.')
        // Jamais dans l'adresse de la page : le numéro transite par le stockage de session.
        sessionStorage.setItem('dsm-client-telephone', tel)
        window.location.href = '/qr'
        return
      }

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
      <Fond />
      <Isobathes />
      <RoseDesVents />
      <Separateur />

      <div className="relative grid min-h-dvh lg:grid-cols-2">
        {/* ─── Zone gauche : la campagne ─── */}
        <div className="flex flex-col px-5 sm:px-10 lg:px-14 xl:px-20">
          <header className="flex items-center gap-3.5 py-6">
            <span className="rounded-[11px] shadow-[0_6px_18px_-6px_rgb(212_175_55/0.55)]">
              <BrandMark size={38} />
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-[0.01em]">
                DSM <span className="text-gold-400">TAMIS</span>
              </p>
              <p className="hidden text-xs tracking-[0.02em] text-navy-200 sm:block">Direction des Solutions Maritimes</p>
            </div>
            <a
              href="/qr"
              className="group ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-navy-100 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            >
              Vous êtes client ?
              <ArrowUpRight className="h-4 w-4 text-gold-400" aria-hidden />
            </a>
          </header>

          <div className="flex flex-1 items-center justify-center py-3">
            <section aria-labelledby="titre-page" className="w-full max-w-xl">
                <h1
                  id="titre-page"
                  className="max-w-2xl animate-entree font-display text-[2.85rem] leading-[0.98] font-medium tracking-[-0.025em] text-white sm:text-[3.75rem] xl:text-[4.4rem]"
                >
                  Évaluation de la performance{' '}
                  <em className="font-normal text-gold-400 italic">des agents</em>
                </h1>
                <span aria-hidden className="mt-6 flex animate-entree items-center gap-2 [animation-delay:80ms]">
                  <span className="h-px w-20 bg-gradient-to-r from-gold-500 to-gold-500/30" />
                  <span className="h-1.5 w-1.5 rotate-45 bg-gold-500" />
                </span>
                <p className="mt-5 hidden max-w-[34rem] animate-entree text-base leading-relaxed text-navy-100/90 [animation-delay:120ms] sm:block sm:text-[1.075rem]">
                  Notez, critère par critère, les collaborateurs qui vous sont attribués. Vos évaluations alimentent le classement de la campagne.
                </p>

                {campagne ? (
                  <div className="relative mt-8 max-w-2xl animate-entree overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.075] to-white/[0.025] p-6 sm:px-7 shadow-[inset_0_1px_0_rgb(255_255_255/0.09)] ring-1 ring-white/10 [animation-delay:180ms]">
                    <span aria-hidden className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
                    <div className="flex flex-col items-start gap-3.5">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 py-1 pr-3 pl-2.5 text-xs font-medium tracking-[0.01em] text-emerald-300 ring-1 ring-emerald-400/25">
                        <span className="relative flex h-1.5 w-1.5" aria-hidden>
                          <span className="absolute inset-0 animate-pouls rounded-full bg-emerald-400" />
                          <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </span>
                        Campagne ouverte
                      </span>
                      <p className="w-full font-display text-[1.65rem] leading-tight font-medium tracking-[-0.01em] text-white sm:text-[1.9rem]">
                        {libelleCampagne(campagne.libelle)}
                      </p>
                    </div>

                    <dl className="mt-6 grid grid-cols-3 divide-x divide-white/10">
                      <div className="pr-4">
                        <dt className="text-[10.5px] font-medium tracking-[0.06em] text-navy-200 uppercase">Clôture</dt>
                        <dd className="mt-2 font-display text-lg font-medium whitespace-nowrap text-white sm:text-xl xl:text-2xl">{formatDateCourte(campagne.dateFin)}</dd>
                      </div>
                      <div className="px-4 sm:px-5">
                        <dt className="text-[10.5px] font-medium tracking-[0.06em] text-navy-200 uppercase">Temps restant</dt>
                        <dd className="mt-2 font-display text-lg font-medium whitespace-nowrap text-white tabular-nums sm:text-xl xl:text-2xl">
                          {jours === 0 ? 'Dernier jour' : `${jours} jour${jours === 1 ? '' : 's'}`}
                        </dd>
                      </div>
                      <div className="pl-4 sm:pl-5">
                        <dt className="text-[10.5px] font-medium tracking-[0.06em] text-navy-200 uppercase">Évaluations soumises</dt>
                        <dd className="mt-2 font-display text-lg font-medium whitespace-nowrap text-gold-300 tabular-nums sm:text-xl xl:text-2xl">{campagne.completionRate} %</dd>
                      </div>
                    </dl>
                    <div
                      className="mt-5 h-[3px] overflow-hidden rounded-full bg-white/[0.08]"
                      role="progressbar"
                      aria-valuenow={campagne.completionRate}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Évaluations soumises"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-200 shadow-[0_0_12px_rgb(212_175_55/0.6)]"
                        style={{ width: `${campagne.completionRate}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-10 max-w-xl animate-entree rounded-2xl bg-white/[0.05] p-7 text-navy-100 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] ring-1 ring-white/10 [animation-delay:180ms]">
                    Aucune campagne d’évaluation n’est ouverte pour le moment.
                  </p>
                )}

                <ol className="mt-7 hidden max-w-2xl animate-entree gap-6 [animation-delay:260ms] sm:grid sm:grid-cols-3">
                  {[
                    ['Identifiez-vous', 'avec votre matricule de collaborateur.'],
                    ['Choisissez un PIN', 'à 4 chiffres lors de votre première connexion.'],
                    ['Notez et soumettez', 'vos évaluations avant la date de clôture.'],
                  ].map(([titre, texte], i) => (
                    <li key={titre} className="relative pt-4">
                      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/12" />
                      <span aria-hidden className="absolute top-0 left-0 h-px w-10 bg-gold-400" />
                      <span className="font-display text-[2rem] leading-none font-normal text-gold-400 italic" aria-label={`Étape ${i + 1}`}>
                        {i + 1}
                      </span>
                      <p className="mt-3 text-sm leading-relaxed text-navy-100/90">
                        <strong className="font-semibold text-white">{titre}</strong> {texte}
                      </p>
                    </li>
                  ))}
                </ol>
            </section>
          </div>

          <footer className="hidden items-center gap-4 border-t border-white/10 py-6 text-sm text-navy-200 sm:flex">
            <div className="rounded-lg bg-white p-1.5 shadow-[0_8px_20px_-8px_rgb(0_10_20/0.7)]">
              <QRCode value={typeof window !== 'undefined' ? `${window.location.origin}/` : '/'} size={52} level="M" fgColor="#002B49" />
            </div>
            <p className="max-w-[15rem] leading-snug">Sur votre téléphone ? Scannez pour ouvrir la plateforme.</p>
          </footer>
        </div>

        {/* ─── Zone droite : la connexion ─── */}
        <div className="flex flex-col px-5 sm:px-10 lg:px-14 xl:px-20">
          <header className="hidden justify-end py-6 lg:flex">
            <a
              href="/qr"
              className="group inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] px-3.5 py-1.5 text-sm text-navy-100 ring-1 ring-white/15 transition-colors hover:bg-white/[0.07] hover:text-white hover:ring-gold-400/40"
            >
              Vous êtes client ? Donnez votre avis
              <ArrowUpRight className="h-4 w-4 text-gold-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </a>
          </header>

          <div className="flex flex-1 items-center justify-center pt-6 pb-10 lg:py-6">
            <section aria-labelledby="titre-connexion" className="relative w-full max-w-[25rem] animate-entree [animation-delay:140ms]">
                {/* Lumière dorée qui détache la carte du fond */}
                <div aria-hidden className="pointer-events-none absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(212_175_55/0.16),transparent)] blur-2xl" />
                <div className="relative overflow-hidden rounded-2xl bg-white p-8 text-slate-900 shadow-[0_40px_80px_-28px_rgb(0_10_20/0.75),0_12px_24px_-12px_rgb(0_10_20/0.45)] sm:p-10">
                  <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
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

                  {etape === 'identifiant' && (
                    <div className="mb-8 grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1 text-sm ring-1 ring-navy-100" role="radiogroup" aria-label="Je suis">
                      {([
                        ['collaborateur', 'Collaborateur'],
                        ['client', 'Client externe'],
                      ] as const).map(([valeur, libelle]) => (
                        <button
                          key={valeur}
                          type="button"
                          role="radio"
                          aria-checked={profil === valeur}
                          onClick={() => {
                            setProfil(valeur)
                            setIdentifiant('')
                            setError('')
                          }}
                          className={`rounded-lg py-2.5 font-medium transition-all duration-200 ${
                            profil === valeur
                              ? 'bg-white text-navy-900 shadow-[0_1px_2px_rgb(0_43_73/0.08),0_4px_10px_-4px_rgb(0_43_73/0.18)]'
                              : 'text-navy-500 hover:text-navy-900'
                          }`}
                        >
                          {libelle}
                        </button>
                      ))}
                    </div>
                  )}

                  <h2 id="titre-connexion" className="font-display text-[2.4rem] leading-none font-medium tracking-[-0.02em] text-navy-900">
                    {titre}
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                    {etape === 'identifiant' &&
                      (profil === 'client'
                        ? 'Le numéro de téléphone enregistré par la DSM, pour donner votre avis sur nos agents.'
                        : 'Votre matricule de collaborateur DSM.')}
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
                        <Champ label={profil === 'client' ? 'Téléphone' : 'Matricule'} htmlFor="identifiant">
                          <input
                            key={profil}
                            id="identifiant"
                            value={identifiant}
                            onChange={(e) => setIdentifiant(e.target.value)}
                            type={profil === 'client' ? 'tel' : 'text'}
                            inputMode={profil === 'client' ? 'tel' : 'text'}
                            autoComplete={profil === 'client' ? 'tel' : 'username'}
                            autoCapitalize={profil === 'client' ? 'off' : 'characters'}
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
                              className={`${INPUT} pr-12 ${champPin ? 'text-xl tracking-[0.5em] tabular-nums' : ''}`}
                            />
                            <button
                              type="button"
                              onClick={() => setVoirSecret((v) => !v)}
                              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800"
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
                            className={`${INPUT} text-xl tracking-[0.5em] tabular-nums`}
                          />
                        </Champ>
                      )}

                      {error && (
                        <p role="alert" className="flex gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800 ring-1 ring-red-100">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-navy-800 to-navy-950 px-5 text-[15px] font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_10px_20px_-10px_rgb(0_26_46/0.7)] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_16px_28px_-12px_rgb(0_26_46/0.75)] active:translate-y-0 disabled:translate-y-0 disabled:opacity-60"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        ) : (
                          <>
                            {etape === 'identifiant' ? 'Continuer' : etape === 'definir' ? 'Enregistrer mon PIN' : 'Se connecter'}
                            <ArrowRight className="h-4 w-4 text-gold-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                          </>
                        )}
                      </button>

                      {etape === 'connexion' && champPin && (
                        <p className="text-sm text-slate-500">PIN oublié ? Demandez une réinitialisation à votre administrateur.</p>
                      )}
                    </form>
                  )}
                </div>
            </section>
          </div>

          <footer className="border-t border-white/10 py-6 text-sm text-navy-200 lg:text-right">
            Direction des Solutions Maritimes · plateforme interne
          </footer>
        </div>
      </div>
    </div>
  )
}

const INPUT =
  'block h-[52px] w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 text-base text-slate-900 shadow-[inset_0_1px_2px_rgb(0_43_73/0.05)] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-navy-700 focus:bg-white focus:ring-4 focus:ring-navy-700/12 disabled:bg-slate-50'

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

/**
 * Ligne de partage entre les deux zones : un filet en dégradé que parcourt lentement une lueur dorée,
 * marqué en son milieu d'un losange. Masqué sur mobile, figé si l'utilisateur réduit les animations.
 */
function Separateur() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-px -translate-x-1/2 lg:block">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
        <div className="h-40 w-px animate-balayage bg-gradient-to-b from-transparent via-gold-400 to-transparent" />
      </div>
      <div className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gold-500 shadow-[0_0_0_4px_rgb(0_43_73),0_0_14px_rgb(212_175_55/0.55)]" />
    </div>
  )
}

/** Profondeur du fond : eau plus claire en haut à gauche, plus sombre vers le large, lumière dorée côté connexion. */
function Fond() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_0%,#0b3d63_0%,transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_100%_100%,#001a2e_0%,transparent_60%)]" />
      <div className="absolute top-[18%] right-[12%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(212_175_55/0.07),transparent)]" />
      {/* Vignettage léger des bords */}
      <div className="absolute inset-0 shadow-[inset_0_0_180px_rgb(0_14_26/0.55)]" />
    </div>
  )
}

/**
 * Isobathes : lignes de profondeur d'une carte marine, en filigrane du fond navy.
 * Une ligne sur quatre est plus marquée, comme les courbes maîtresses d'une carte.
 */
function Isobathes() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full text-white"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
    >
      {Array.from({ length: 18 }, (_, i) => {
        const r = 100 + i * 58
        const maitresse = i % 4 === 0
        return (
          <path
            key={i}
            strokeWidth={maitresse ? 1.2 : 0.8}
            strokeOpacity={maitresse ? 0.07 : 0.035}
            strokeDasharray={i % 4 === 2 ? '2 6' : undefined}
            d={`M ${-40} ${900 - r * 0.2} C ${r * 0.9} ${900 - r * 1.15}, ${720 + r * 0.25} ${620 - r * 0.55}, 1480 ${560 - r * 0.62}`}
          />
        )
      })}
    </svg>
  )
}

/** Rose des vents de carte marine, en filigrane derrière la connexion. Géométrie pure. */
function RoseDesVents() {
  const rayons = Array.from({ length: 72 }, (_, i) => i * 5)
  return (
    <svg
      aria-hidden
      viewBox="-300 -300 600 600"
      className="pointer-events-none absolute top-1/2 left-3/4 hidden h-[52rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 text-white lg:block"
      fill="none"
      stroke="currentColor"
    >
      <g strokeOpacity="0.06">
        <circle r="290" strokeWidth="1" />
        <circle r="276" strokeWidth="0.6" />
        <circle r="200" strokeWidth="0.6" strokeDasharray="1 5" />
        <circle r="120" strokeWidth="0.8" />
      </g>
      {/* Graduations du cercle extérieur */}
      <g strokeOpacity="0.07">
        {rayons.map((a) => (
          <line key={a} x1="0" y1={a % 45 === 0 ? -262 : -270} x2="0" y2="-276" strokeWidth={a % 45 === 0 ? 1.2 : 0.6} transform={`rotate(${a})`} />
        ))}
      </g>
      {/* Pointes : cardinales longues, intercardinales courtes */}
      {[0, 90, 180, 270].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M0 -250 L16 -16 L0 0 Z" fill="currentColor" fillOpacity="0.05" strokeOpacity="0.08" strokeWidth="0.8" />
          <path d="M0 -250 L-16 -16 L0 0 Z" fill="currentColor" fillOpacity="0.02" strokeOpacity="0.08" strokeWidth="0.8" />
        </g>
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} transform={`rotate(${a})`} d="M0 -160 L10 -10 L0 0 L-10 -10 Z" fill="currentColor" fillOpacity="0.025" strokeOpacity="0.06" strokeWidth="0.6" />
      ))}
      {/* Nord en or */}
      <path d="M0 -250 L16 -16 L0 0 Z" className="text-gold-400" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" fill="currentColor" fillOpacity="0.12" />
      <circle r="5" className="text-gold-400" fill="currentColor" fillOpacity="0.3" stroke="none" />
    </svg>
  )
}
