'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Mail,
  UserCheck,
  Award,
  ShieldCheck,
  ChevronRight,
  Smartphone,
  Loader2,
  Lock,
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
} from 'lucide-react'

type Mode = 'register' | 'login'

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('register')

  // Champs de création de compte / connexion
  const [matricule, setMatricule] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'auth_required') {
      setError('Veuillez vous connecter pour accéder au formulaire de notation.')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const evaluationUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : '/'

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!matricule.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Tous les champs sont obligatoires.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    if (password.length < 4) {
      setError('Le mot de passe doit contenir au moins 4 caractères.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricule: matricule.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création du compte')
        return
      }

      // Inscription et connexion réussies
      if (data.role === 'ADMIN' || data.role === 'MANAGER') {
        router.push('/admin')
      } else {
        router.push('/evaluer')
      }
    } catch {
      setError('Erreur de connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!matricule.trim() || !password) {
      setError('Veuillez renseigner votre matricule et votre mot de passe.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricule: matricule.trim(),
          password,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Identifiants incorrects')
        return
      }

      // Connexion réussie
      if (data.role === 'ADMIN' || data.role === 'MANAGER') {
        router.push('/admin')
      } else {
        router.push('/evaluer')
      }
    } catch {
      setError('Erreur de connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-100/50 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/30 blur-[100px] rounded-full"></div>
      </div>

      <header className="relative z-10 py-6 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
              <Award className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-display font-black tracking-tight text-slate-900">
              DSM <span className="text-brand-500">Premium</span>
            </h1>
          </div>
          <Link
            href="/admin"
            className="text-sm font-bold text-slate-500 hover:text-brand-600 transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100"
          >
            Administration
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="max-w-7xl w-full grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 bg-brand-50 text-brand-600 text-xs font-extrabold rounded-full tracking-wider uppercase">
                <ShieldCheck className="w-4 h-4" /> Plateforme de notation des agents DSM
              </span>
              <h2 className="text-4xl sm:text-5xl font-display font-black text-slate-900 leading-[1.1]">
                Évaluation <span className="text-gradient">360°</span> de la Performance.
              </h2>
              <p className="text-base sm:text-lg text-slate-500 font-medium max-w-lg leading-relaxed">
                Pour avoir accès au formulaire de notation, veuillez créer votre compte notant ou vous connecter.
              </p>
            </div>

            <div className="glass rounded-3xl p-8 border border-white/60 shadow-glass max-w-md w-full">
              {/* Onglets Créer un compte / Connexion */}
              <div className="flex bg-slate-100/80 p-1 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError('')
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UserPlus className="w-4 h-4" /> Créer mon compte
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError('')
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <LogIn className="w-4 h-4" /> Se connecter
                </button>
              </div>

              {/* Formulaire Créer un compte */}
              {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Votre Matricule *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                        placeholder="ex: 7453 ou DSM001"
                        className="w-full px-4 py-3 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white text-base font-bold uppercase transition-all outline-none"
                        required
                        disabled={loading}
                      />
                      <UserCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Votre Adresse Email *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@entreprise.com"
                        className="w-full px-4 py-3 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white text-sm font-medium transition-all outline-none"
                        required
                        disabled={loading}
                      />
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-10 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white text-sm transition-all outline-none"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Confirmer le mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-10 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white text-sm transition-all outline-none"
                        required
                        disabled={loading}
                      />
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full premium-gradient hover:shadow-xl hover:shadow-brand-200 text-white font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Création du compte...
                      </>
                    ) : (
                      <>
                        Créer mon compte <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Formulaire Se Connecter */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Votre Matricule ou Email
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value)}
                        placeholder="ex: 7453 ou mail@domaine.com"
                        className="w-full px-4 py-3 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white text-base font-semibold transition-all outline-none"
                        required
                        disabled={loading}
                      />
                      <UserCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-10 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white text-sm transition-all outline-none"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full premium-gradient hover:shadow-xl hover:shadow-brand-200 text-white font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-4"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Connexion en cours...
                      </>
                    ) : (
                      <>
                        Se connecter <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div
            className="hidden lg:flex flex-col items-center animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            <div className="relative">
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-brand-50 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-emerald-50 rounded-full blur-3xl"></div>

              <div className="relative bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100 text-center space-y-8">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                    <Smartphone className="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-slate-800">
                    Accès Mobile Rapide
                  </h3>
                  <p className="text-sm text-slate-400 font-medium">
                    Scannez pour accéder au formulaire depuis votre téléphone
                  </p>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 group transition-all hover:bg-white hover:border-brand-300">
                  <QRCodeSVG
                    value={evaluationUrl}
                    size={200}
                    level="H"
                    includeMargin
                    fgColor="#0f172a"
                    className="transition-transform group-hover:scale-[1.02]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 px-6 sm:px-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 font-medium text-sm">
          <span>© 2026 DSM Intelligence • Système de Notation du Meilleur Agent</span>
          <div className="flex items-center gap-8">
            <Link href="/admin" className="text-slate-900 font-bold hover:text-brand-600 transition-colors">
              Espace Administrateur
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
