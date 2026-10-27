'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, CircleCheck, Eye, EyeOff, Info, Loader2, Lock, Phone, User } from 'lucide-react'
import { destinationPourRole } from '@/lib/roles'
import { BrandMark } from '@/components/BrandMark'
import { libelleCampagne } from '@/lib/libelle'

const QRCode = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })

type Etape = 'identifiant' | 'connexion' | 'definir' | 'contact_admin'

type CampagnePublique = { libelle: string; dateFin: string; completionRate: number } | null

const MESSAGES_REDIRECTION: Record<string, string> = {
  admin_required: 'Cet espace est réservé aux administrateurs. Connectez-vous avec un compte administrateur.',
  auth_required: 'Connectez-vous pour continuer.',
  session_expired: 'Votre session a expiré. Connectez-vous à nouveau.',
}

const ETAPES_GUIDE = [
  ['Identification', 'Saisissez votre matricule officiel DSM pour démarrer votre session.'],
  ['Code PIN', 'Définissez ou renseignez votre PIN sécurisé à 4 chiffres lors de l’accès.'],
  ['Notation', 'Notez et soumettez l’ensemble de vos agents avant la clôture officielle.'],
] as const

function formatDateCourte(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Jours restants jusqu'à la fin du dernier jour de la campagne (0 = dernier jour). */
function joursRestants(iso: string) {
  const fin = new Date(iso)
  fin.setHours(23, 59, 59, 999)
  return Math.max(0, Math.floor((fin.getTime() - Date.now()) / 86_400_000))
}

/** « 1ere Campagne… » → 1<sup>ère</sup> Campagne… */
function TitreCampagne({ libelle }: { libelle: string }) {
  const texte = libelleCampagne(libelle)
  const m = texte.match(/^(\d+)(?:ere|ère|er|e)\s+(.*)$/i)
  if (!m) return <>{texte}</>
  const suffixe = m[1] === '1' ? 'ère' : 'e'
  return (
    <>
      {m[1]}
      <sup className="text-[0.55em] font-semibold">{suffixe}</sup> {m[2]}
    </>
  )
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
  const [aideOuverte, setAideOuverte] = useState(false)
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
  const estClient = profil === 'client'
  const titre = {
    identifiant: 'Connexion',
    connexion: estAdmin ? 'Votre mot de passe' : 'Votre PIN',
    definir: 'Choisissez votre PIN',
    contact_admin: 'Compte à activer',
  }[etape]
  const jours = campagne ? joursRestants(campagne.dateFin) : null
  const annee = campagne ? new Date(campagne.dateFin).getFullYear() : new Date().getFullYear()

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#071a33] text-white">
      <Fond />
      <Quadrillage />
      <Compas />

      <div className="relative flex min-h-dvh w-full flex-col px-5 sm:px-10 lg:px-[clamp(3rem,6vw,9rem)]">
        {/* ─── En-tête ─── */}
        <header className="flex items-center gap-4 border-b border-white/[0.06] py-6 sm:py-7">
          <span className="rounded-2xl bg-gradient-to-b from-gold-300 to-gold-600 p-[3px] shadow-[0_10px_28px_-8px_rgb(212_175_55/0.6)]">
            <BrandMark size={50} />
          </span>
          <div className="leading-tight">
            <p className="flex items-center gap-2.5 text-lg font-semibold tracking-[0.02em] sm:text-xl">
              DSM TAMIS
              <span className="rounded-full px-2.5 py-0.5 text-2xs font-semibold tracking-[0.12em] text-gold-300 ring-1 ring-gold-400/50">
                OFFICIEL
              </span>
            </p>
            <p className="mt-1 hidden text-sm tracking-[0.02em] text-navy-200 sm:block">Direction des Solutions Maritimes</p>
          </div>
          <Link
            href="/qr"
            className="group ml-auto inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-4 py-2.5 text-sm text-navy-100 ring-1 ring-white/15 transition-colors hover:bg-white/[0.07] hover:text-white hover:ring-gold-400/40"
          >
            <span className="hidden sm:inline">Vous êtes client ?</span>
            <strong className="font-semibold text-white">Donnez votre avis</strong>
            <ArrowUpRight className="h-4 w-4 text-gold-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </header>

        <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-[clamp(3rem,6vw,10rem)] lg:py-14 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:gap-[clamp(3rem,4vw,7rem)] 2xl:py-8">
          {/* ─── Présentation et campagne ─── */}
          <section aria-labelledby="titre-page" className="min-w-0 lg:max-w-[clamp(40rem,46vw,60rem)]">
            <span className="inline-flex animate-entree items-center gap-2.5 rounded-full bg-navy-900/70 px-4 py-2 text-xs font-semibold tracking-[0.08em] text-navy-100 ring-1 ring-white/15 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.7)]" aria-hidden />
              PORTAIL RH INTERNE SÉCURISÉ
            </span>

            <h1
              id="titre-page"
              className="mt-8 animate-entree text-[2.9rem] leading-[1.02] font-semibold tracking-[-0.035em] text-white [animation-delay:60ms] sm:text-[3.9rem] xl:text-[clamp(4.5rem,3.6vw,5.25rem)]"
            >
              Évaluation de la performance
              <em className="mt-1 block font-display text-[0.95em] font-normal tracking-[-0.01em] text-gold-300 italic">des agents de la DSM</em>
            </h1>

            <p className="mt-6 max-w-[44rem] animate-entree text-base leading-relaxed text-navy-200 [animation-delay:120ms] sm:text-[1.2rem] sm:leading-[1.6] 2xl:max-w-[50rem] 2xl:text-[1.25rem]">
              Notez, critère par critère, les collaborateurs qui vous sont attribués. Vos évaluations alimentent avec équité le classement
              d’excellence de la campagne.
            </p>

            {campagne ? (
              <div className="relative mt-10 max-w-[45rem] 2xl:mt-8 2xl:max-w-none animate-entree overflow-hidden rounded-2xl bg-gradient-to-b from-[#12294a] to-[#0d2140] p-6 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10 [animation-delay:180ms] sm:p-9">
                <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 py-1.5 pr-3.5 pl-3 text-sm font-medium text-emerald-300 ring-1 ring-emerald-400/30">
                    <span className="relative flex h-2 w-2" aria-hidden>
                      <span className="absolute inset-0 animate-pouls rounded-full bg-emerald-400" />
                      <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    Campagne ouverte
                  </span>
                  <span className="text-sm text-navy-200">Session annuelle {annee}</span>
                </div>

                <p className="mt-6 text-[1.7rem] leading-tight font-semibold tracking-[-0.02em] text-white sm:text-[2rem]">
                  <TitreCampagne libelle={campagne.libelle} />
                </p>

                <dl className="mt-7 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-7">
                  <Statistique libelle="Clôture" className="pr-4">
                    {formatDateCourte(campagne.dateFin)}
                  </Statistique>
                  <Statistique libelle="Temps restant" className="px-4 text-gold-300 sm:px-6">
                    {jours === 0 ? 'Dernier jour' : `${jours} jour${jours === 1 ? '' : 's'}`}
                  </Statistique>
                  <Statistique libelle="Évaluations" className="pl-4 sm:pl-6">
                    {campagne.completionRate}%<span className="ml-2 text-xs font-normal text-navy-200">soumises</span>
                  </Statistique>
                </dl>
              </div>
            ) : (
              <p className="mt-10 max-w-[45rem] 2xl:max-w-none animate-entree rounded-2xl bg-white/[0.05] p-8 text-navy-100 ring-1 ring-white/10 [animation-delay:180ms]">
                Aucune campagne d’évaluation n’est ouverte pour le moment.
              </p>
            )}
          </section>

          {/* ─── Connexion, avec les étapes juste à côté sur grand écran ─── */}
          <div className="flex w-full items-center gap-[clamp(2.5rem,3vw,4rem)] lg:justify-self-center 2xl:w-auto">
            <EtapesConnexion active={etape === 'identifiant' ? 0 : 1} />
            <section aria-labelledby="titre-connexion" className="relative w-full animate-entree [animation-delay:140ms] lg:max-w-[clamp(28rem,22vw,33rem)] 2xl:w-[clamp(28rem,22vw,33rem)]">
              <div aria-hidden className="pointer-events-none absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(212_175_55/0.12),transparent)] blur-2xl" />
              <div className="relative rounded-[28px] bg-[#f4f6f9] p-7 text-slate-900 shadow-[0_50px_90px_-30px_rgb(0_0_0/0.75),0_14px_30px_-14px_rgb(0_0_0/0.45)] sm:p-12">
                <Lock className="absolute top-7 right-7 h-5 w-5 text-slate-300" aria-hidden />
  
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
  
                {etape === 'identifiant' && (
                  <div className="mt-4 mb-12 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/50 p-1.5 ring-1 ring-slate-200" role="radiogroup" aria-label="Je suis">
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
                          setAideOuverte(false)
                        }}
                        className={`rounded-xl py-3 text-[15px] transition-all duration-200 ${
                          profil === valeur
                            ? 'bg-white font-medium text-navy-950 shadow-[0_1px_2px_rgb(0_43_73/0.08),0_6px_14px_-6px_rgb(0_43_73/0.2)]'
                            : 'text-navy-500 hover:text-navy-900'
                        }`}
                      >
                        {libelle}
                      </button>
                    ))}
                  </div>
                )}
  
                <h2 id="titre-connexion" className="font-display text-[2.6rem] leading-none font-medium tracking-[-0.02em] text-navy-950">
                  {titre}
                </h2>
                <p className="mt-4 text-[1.05rem] leading-relaxed text-navy-500">
                  {etape === 'identifiant' &&
                    (estClient
                      ? 'Le numéro de téléphone enregistré par la DSM est requis pour donner votre avis sur nos agents.'
                      : 'Votre matricule de collaborateur DSM est requis pour poursuivre.')}
                  {etape === 'connexion' && (
                    <>
                      Compte <strong className="font-semibold text-slate-900">{identifiant}</strong>
                      {champPin ? ' · le PIN à 4 chiffres que vous avez choisi.' : '.'}
                    </>
                  )}
                  {etape === 'definir' && (
                    <>
                      Première connexion pour <strong className="font-semibold text-slate-900">{identifiant}</strong>. Ce PIN vous servira à chaque
                      connexion ; seul un administrateur pourra le réinitialiser.
                    </>
                  )}
                  {etape === 'contact_admin' &&
                    'Ce compte administrateur n’a pas encore de mot de passe. Il doit être initialisé par la commande d’installation.'}
                </p>
  
                {etape !== 'contact_admin' && (
                  <form onSubmit={handleSubmit} className="mt-9 space-y-6" noValidate>
                    {etape === 'identifiant' && (
                      <div>
                        <Champ label={estClient ? 'Numéro de téléphone' : 'Matricule collaborateur'} htmlFor="identifiant">
                          <div className="relative">
                            {estClient ? <Phone className={ICONE_CHAMP} aria-hidden /> : <User className={ICONE_CHAMP} aria-hidden />}
                            <input
                              key={profil}
                              id="identifiant"
                              value={identifiant}
                              onChange={(e) => setIdentifiant(e.target.value)}
                              type={estClient ? 'tel' : 'text'}
                              inputMode={estClient ? 'tel' : 'text'}
                              autoComplete={estClient ? 'tel' : 'username'}
                              autoCapitalize={estClient ? 'off' : 'characters'}
                              placeholder={estClient ? 'Ex. : 07 00 00 00 00' : 'Ex. : 1234'}
                              spellCheck={false}
                              autoFocus
                              required
                              disabled={loading}
                              className={`${INPUT} pl-12`}
                            />
                          </div>
                        </Champ>
                        <p className="mt-3 flex items-start gap-2 text-xs text-navy-400">
                          <Info className="mt-px h-4 w-4 shrink-0 text-gold-600" aria-hidden />
                          {estClient ? 'Le numéro communiqué à la DSM lors de votre enregistrement.' : 'Format d’identifiant habituel délivré par les Ressources Humaines.'}
                        </p>
                      </div>
                    )}
  
                    {(etape === 'connexion' || etape === 'definir') && (
                      <Champ label={etape === 'definir' ? 'Nouveau PIN (4 chiffres)' : champPin ? 'Code PIN' : 'Mot de passe'} htmlFor="secret">
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
                            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-800"
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
                      className="group relative flex h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#050d1a] px-5 text-[1.05rem] font-semibold text-white shadow-[0_18px_30px_-14px_rgb(5_13_26/0.8)] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_22px_36px_-14px_rgb(5_13_26/0.85)] active:translate-y-0 disabled:translate-y-0 disabled:opacity-60"
                    >
                      {/* Filet doré sous le bouton, comme sur la maquette */}
                      <span aria-hidden className="absolute inset-x-12 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-transparent via-gold-400 to-transparent blur-[1px]" />
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <>
                          {etape === 'identifiant' ? 'Continuer' : etape === 'definir' ? 'Enregistrer mon PIN' : 'Se connecter'}
                          <ArrowRight className="h-5 w-5 text-gold-300 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                        </>
                      )}
                    </button>
  
                    {etape === 'connexion' && champPin && (
                      <p className="text-sm text-slate-500">PIN oublié ? Demandez une réinitialisation à votre administrateur.</p>
                    )}
                  </form>
                )}
  
                <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-sm">
                  {etape === 'identifiant' && !estClient ? (
                    <button
                      type="button"
                      onClick={() => setAideOuverte((v) => !v)}
                      aria-expanded={aideOuverte}
                      className="text-navy-500 underline-offset-4 hover:text-navy-900 hover:underline"
                    >
                      Matricule oublié ou perdu ?
                    </button>
                  ) : (
                    <span />
                  )}
                  <span className="inline-flex items-center gap-1.5 text-navy-400">
                    <CircleCheck className="h-4 w-4 text-emerald-500" aria-hidden />
                    Connexion chiffrée
                  </span>
                </div>
                {aideOuverte && etape === 'identifiant' && !estClient && (
                  <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm leading-relaxed text-navy-600 ring-1 ring-slate-200">
                    Adressez-vous aux Ressources Humaines ou à l’administrateur de la plateforme : ils vous communiqueront votre matricule.
                  </p>
                )}
              </div>
            </section>
          </div>
        </main>

        {/* ─── Étapes : bandeau sur toute la largeur, quand la place manque à côté de la connexion ─── */}
        <ol className="hidden animate-entree gap-8 border-t border-white/[0.06] py-8 [animation-delay:260ms] sm:grid sm:grid-cols-3 lg:gap-[clamp(3rem,6vw,10rem)] 2xl:hidden">
          {ETAPES_GUIDE.map(([titreEtape, texte], i) => (
            <li key={titreEtape} className="flex items-start gap-5">
              <span className="shrink-0 font-display text-[2.1rem] leading-none text-gold-300 italic" aria-label={`Étape ${i + 1}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="max-w-[26rem]">
                <p className="text-[1.05rem] font-semibold text-white">{titreEtape}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-200">{texte}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* ─── Pied de page ─── */}
        <footer className="flex flex-col gap-6 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="hidden items-center gap-4 rounded-2xl bg-white/[0.04] p-3 pr-6 ring-1 ring-white/10 sm:flex">
            <div className="rounded-lg bg-white p-1.5">
              <QRCode value={typeof window !== 'undefined' ? `${window.location.origin}/` : '/'} size={52} level="M" fgColor="#002B49" />
            </div>
            <div className="text-sm leading-snug">
              <p className="font-medium text-white">Sur votre téléphone ?</p>
              <p className="text-navy-200">Scannez pour ouvrir la plateforme mobile</p>
            </div>
          </div>
          <div className="text-sm text-navy-200 sm:text-right">
            <p>
              <strong className="font-medium text-white">Direction des Solutions Maritimes</strong> · Plateforme d’évaluation interne
            </p>
            <p className="mt-1 text-xs text-navy-300/80">Tous droits réservés © {new Date().getFullYear()} DSM TAMIS.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

const INPUT =
  'block h-[60px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[1.05rem] text-slate-900 shadow-[0_1px_2px_rgb(0_43_73/0.04)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-navy-700 focus:ring-4 focus:ring-navy-700/12 disabled:bg-slate-50'

const ICONE_CHAMP = 'pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400'

/** Étapes de connexion en colonne, à gauche de la carte (grands écrans) ; l’étape en cours est mise en avant. */
function EtapesConnexion({ active }: { active: number }) {
  return (
    <ol aria-label="Étapes de connexion" className="relative hidden w-[15rem] shrink-0 animate-entree flex-col gap-10 [animation-delay:200ms] 2xl:flex">
      <span aria-hidden className="absolute top-3 bottom-3 left-[1.05rem] w-px bg-gradient-to-b from-gold-400/50 via-white/10 to-transparent" />
      {ETAPES_GUIDE.map(([titreEtape, texte], i) => {
        const enCours = i === active
        return (
          <li key={titreEtape} aria-current={enCours ? 'step' : undefined} className="relative flex items-start gap-5">
            <span
              className={`relative shrink-0 bg-[#071a33] py-1 font-display text-[2.1rem] leading-none italic transition-colors ${
                enCours ? 'text-gold-300' : 'text-gold-300/40'
              }`}
              aria-label={`Étape ${i + 1}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="pt-1">
              <p className={`text-[1.05rem] font-semibold transition-colors ${enCours ? 'text-white' : 'text-navy-100/70'}`}>{titreEtape}</p>
              <p className={`mt-1.5 text-sm leading-relaxed transition-colors ${enCours ? 'text-navy-200' : 'text-navy-300/70'}`}>{texte}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Champ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-3 block text-sm font-semibold tracking-[0.06em] text-navy-900 uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

function Statistique({ libelle, className, children }: { libelle: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium tracking-[0.1em] text-navy-200 uppercase">{libelle}</dt>
      <dd className="mt-3 text-xl font-semibold whitespace-nowrap tabular-nums sm:text-2xl">{children}</dd>
    </div>
  )
}

/** Profondeur du fond : bleu nuit plus clair en haut, plus sombre vers le bas, halo doré discret. */
function Fond() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_15%_0%,#0f2f57_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_100%_100%,#04101f_0%,transparent_65%)]" />
      <div className="absolute top-[30%] left-[22%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(212_175_55/0.06),transparent)]" />
      <div className="absolute inset-0 shadow-[inset_0_0_200px_rgb(2_10_22/0.6)]" />
    </div>
  )
}

/** Quadrillage de carte marine, très discret, qui s'estompe vers les bords. */
function Quadrillage() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:120px_120px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
    />
  )
}

/** Compas de carte marine en filigrane, centré en bas de page, avec sa ligne d'horizon. */
function Compas() {
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-0 left-[60%] hidden h-[34rem] w-[34rem] -translate-x-1/2 translate-y-[38%] lg:block">
      <div className="absolute top-1/2 left-1/2 h-px w-[66rem] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <svg viewBox="-300 -300 600 600" className="h-full w-full text-white" fill="none" stroke="currentColor">
        <g strokeOpacity="0.09">
          <circle r="290" strokeWidth="1" />
          <circle r="200" strokeWidth="0.8" strokeDasharray="2 6" />
          <circle r="120" strokeWidth="0.8" />
        </g>
        {[0, 90, 180, 270].map((a) => (
          <path key={a} transform={`rotate(${a})`} d="M0 -270 L8 -10 L0 0 L-8 -10 Z" fill="currentColor" fillOpacity="0.05" strokeOpacity="0.1" strokeWidth="0.8" />
        ))}
        <circle r="7" className="text-gold-400" fill="currentColor" fillOpacity="0.35" stroke="none" />
      </svg>
    </div>
  )
}
