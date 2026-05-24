'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Mail,
  Users,
  Award,
  ShieldCheck,
  ChevronRight,
  Smartphone,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

type Step = 'identify' | 'otp'

export default function Home() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('identify')
  const [matricule, setMatricule] = useState('')
  const [email, setEmail] = useState('')
  const [emailMasked, setEmailMasked] = useState('')
  const [code, setCode] = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'auth_required') {
      setError('Veuillez vous connecter pour accéder à cette page.')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const evaluationUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : '/'

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [resendIn])

  useEffect(() => {
    if (step === 'otp' && inputsRef.current[0]) {
      inputsRef.current[0].focus()
    }
  }, [step])

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!matricule.trim() || !email.trim()) return
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: matricule.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue')
        return
      }
      setEmailMasked(data.emailMasked || email)
      if (data.channel === 'console') {
        setInfo('Mode développement : le code apparaît dans la console serveur')
      }
      setStep('otp')
      setResendIn(60)
      setCode(['', '', '', '', '', ''])
    } catch (err) {
      setError('Erreur réseau, réessayez')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const joined = code.join('')
    if (joined.length !== 6) {
      setError('Saisissez les 6 chiffres')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: matricule.trim(), code: joined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Code incorrect')
        return
      }
      if (data.role === 'ADMIN' || data.role === 'MANAGER') {
        router.push('/admin')
      } else {
        router.push('/evaluer')
      }
    } catch (err) {
      setError('Erreur réseau, réessayez')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[idx] = digit
    setCode(next)
    if (digit && idx < 5) inputsRef.current[idx + 1]?.focus()
    if (digit && idx === 5 && next.every((c) => c)) {
      // Auto-submit dès que les 6 chiffres sont saisis
      setTimeout(() => handleVerify(), 50)
    }
  }

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus()
    }
  }

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 0) return
    e.preventDefault()
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setCode(next)
    const focusIdx = Math.min(pasted.length, 5)
    inputsRef.current[focusIdx]?.focus()
    if (pasted.length === 6) setTimeout(() => handleVerify(), 50)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-100/50 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/30 blur-[100px] rounded-full"></div>
      </div>

      <header className="relative z-10 py-8 px-6 sm:px-12">
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
        <div className="max-w-7xl w-full grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10 animate-fade-in">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 text-brand-600 text-xs font-bold rounded-full tracking-wider uppercase">
                <ShieldCheck className="w-3.5 h-3.5" /> Accès sécurisé 2FA
              </span>
              <h2 className="text-4xl sm:text-5xl font-display font-black text-slate-900 leading-[1.1]">
                Évaluez la <span className="text-gradient">Performance</span> avec Précision.
              </h2>
              <p className="text-lg text-slate-500 font-medium max-w-lg leading-relaxed">
                Le portail sécurisé pour la notation des agents DSM. Vérification en deux étapes par
                email.
              </p>
            </div>

            <div className="glass rounded-3xl p-8 border border-white/50 shadow-glass max-w-md">
              {step === 'identify' && (
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Identification</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Étape 1/2 — Recevez votre code par email
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="matricule"
                        className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                      >
                        Votre matricule
                      </label>
                      <input
                        type="text"
                        id="matricule"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                        placeholder="ex: DSM001"
                        className="w-full px-5 py-4 bg-white/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white text-lg font-bold uppercase transition-all outline-none"
                        required
                        autoComplete="off"
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="email"
                        className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                      >
                        Votre email
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          id="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="vous@entreprise.com"
                          className="w-full px-5 py-4 pr-12 bg-white/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white text-base font-medium transition-all outline-none"
                          required
                          autoComplete="email"
                          disabled={loading}
                        />
                        <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-100 text-red-600 text-sm font-semibold rounded-xl px-4 py-3">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !matricule || !email}
                      className="w-full premium-gradient hover:shadow-xl hover:shadow-brand-200 text-white font-bold py-4 px-6 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        <>
                          Recevoir le code <ChevronRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}

              {step === 'otp' && (
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <Mail className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Vérification</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Étape 2/2 — Saisissez le code reçu
                      </p>
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-800 font-medium">
                      Code envoyé à <strong className="font-bold">{emailMasked}</strong>
                    </p>
                  </div>

                  {info && (
                    <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs font-medium rounded-xl px-4 py-3 mb-4">
                      {info}
                    </div>
                  )}

                  <form onSubmit={handleVerify} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Code à 6 chiffres
                      </label>
                      <div className="flex gap-2 justify-between">
                        {code.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => {
                              inputsRef.current[idx] = el
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleCodeChange(idx, e.target.value)}
                            onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                            onPaste={handleCodePaste}
                            className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-black bg-white/50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white transition-all outline-none"
                            disabled={loading}
                          />
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-100 text-red-600 text-sm font-semibold rounded-xl px-4 py-3">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || code.join('').length !== 6}
                      className="w-full premium-gradient hover:shadow-xl hover:shadow-brand-200 text-white font-bold py-4 px-6 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Vérification...
                        </>
                      ) : (
                        <>
                          Valider <ChevronRight className="w-5 h-5" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStep('identify')
                          setError('')
                          setInfo('')
                          setCode(['', '', '', '', '', ''])
                        }}
                        className="text-sm font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        <ArrowLeft className="w-4 h-4" /> Retour
                      </button>
                      <button
                        type="button"
                        disabled={resendIn > 0 || loading}
                        onClick={() => handleSendOtp()}
                        className="text-sm font-bold text-brand-600 hover:text-brand-700 disabled:text-slate-300 disabled:cursor-not-allowed"
                      >
                        {resendIn > 0 ? `Renvoyer dans ${resendIn}s` : 'Renvoyer le code'}
                      </button>
                    </div>
                  </form>
                </>
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
                    Évaluation Mobile
                  </h3>
                  <p className="text-sm text-slate-400 font-medium">
                    Scannez pour évaluer en déplacement
                  </p>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 group transition-all hover:bg-white hover:border-brand-300">
                  <QRCodeSVG
                    value={evaluationUrl}
                    size={220}
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

      <footer className="relative z-10 py-10 px-6 sm:px-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-slate-400 font-medium text-sm">
          <span>© 2026 DSM Intelligence • Système de Performance Premium</span>
          <div className="flex items-center gap-8">
            <Link href="/admin" className="text-slate-900 font-bold hover:text-brand-600 transition-colors">
              Portail Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
