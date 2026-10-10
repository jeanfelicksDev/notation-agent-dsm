'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

const DynamicQR = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false })
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Smartphone,
  Loader2,
  Lock,
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
  TrendingUp,
  Star,
  Users,
  Award,
  LayoutDashboard,
  Anchor,
  CheckCircle2,
  Zap,
  Globe,
} from 'lucide-react'

type Mode = 'register' | 'login'

/* ─── Animated Counter Hook ─── */
function useCounter(target: number, duration = 1200, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return value
}



/* ─── Particles Canvas ─── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: { x: number; y: number; r: number; vx: number; vy: number; alpha: number }[] = []

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 38; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.5 + 0.1,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(212,175,55,${p.alpha})`
        ctx.fill()
      })

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(212,175,55,${0.06 * (1 - dist / 100)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
/** Met en majuscule la 1ère lettre de chaque mot, le reste en minuscules ("PHASE PILOTE" → "Phase Pilote") */
const capitalizeWords = (s: string) =>
  s.toLowerCase().replace(/(^|[\s'\-‐–—])([a-zà-öø-ÿ])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('register')
  const [visible, setVisible] = useState(false)
  const [evaluationUrl, setEvaluationUrl] = useState('/')

  const [matricule, setMatricule] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [campaignLabel, setCampaignLabel] = useState('')
  const [statsData, setStatsData] = useState<{
    agentsCount: number
    campagnesCount: number
    completionRate: number
  }>({
    agentsCount: 0,
    campagnesCount: 0,
    completionRate: 0,
  })

  const [user, setUser] = useState<{ id: string; matricule: string; role: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Animated counters connected to live database values
  const agentCount = useCounter(statsData.agentsCount, 1400, visible && statsData.agentsCount > 0)
  const campagneCount = useCounter(statsData.campagnesCount, 900, visible && statsData.campagnesCount > 0)
  const scoreCount = useCounter(statsData.completionRate, 1600, visible && statsData.completionRate > 0)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    // Check if session is already active and auto-redirect if so
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setUser(data.user)
          // Seul l'administrateur accède à l'espace admin ; MANAGER et UTILISATEUR vont sur la page de notation
          const target = data.user.role === 'ADMIN'
            ? '/admin'
            : data.user.role === 'EXTERNE'
            ? '/qr'
            : '/evaluer'
          window.location.href = target
        }
      })
      .catch(() => {})

    // Load real platform statistics & active campaign info
    fetch('/api/stats/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setStatsData({
            agentsCount: data.agentsCount || 0,
            campagnesCount: data.campagnesCount || 0,
            completionRate: data.completionRate || 0,
          })
          if (data.campaignLabel) {
            setCampaignLabel(capitalizeWords(data.campaignLabel))
          }
        }
      })
      .catch(() => {})

    setEvaluationUrl(`${window.location.origin}/`)

    const params = new URLSearchParams(window.location.search)
    const reason = params.get('reason')
    if (reason === 'admin_required' || reason === 'admin_unauthorized') {
      setMode('login')
      setError('Accès réservé aux administrateurs. Veuillez vous connecter avec vos identifiants Administrateur.')
      window.history.replaceState({}, '', '/')
    } else if (reason === 'auth_required' || reason === 'session_expired') {
      setMode('login')
      setError('Votre session a expiré ou une connexion est requise. Veuillez vous connecter.')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const handleAdminClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!user) {
      setMode('login')
      setError('Veuillez vous connecter avec vos identifiants administrateur.')
    } else if (user.role === 'ADMIN') {
      window.location.href = '/admin'
    } else {
      setError(`Accès refusé : seul un compte Administrateur a accès à l'espace d'administration (votre compte : ${user.role}).`)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!matricule.trim() || !password) {
      setError('Veuillez renseigner votre matricule ou téléphone et votre mot de passe à 4 chiffres.')
      return
    }
    if (!/^\d{4}$/.test(password.trim())) {
      setError('Le mot de passe doit comporter exactement 4 chiffres.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricule: matricule.trim(),
          password: password.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur lors de la création du compte'); return }
      const target = data.role === 'ADMIN'
        ? '/admin'
        : data.role === 'EXTERNE'
        ? '/qr'
        : '/evaluer'
      window.location.href = target
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
      setError('Veuillez renseigner votre matricule ou téléphone et votre mot de passe.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMatricule: matricule.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Matricule/Téléphone ou mot de passe incorrect'); return }
      const target = data.role === 'ADMIN'
        ? '/admin'
        : data.role === 'EXTERNE'
        ? '/qr'
        : '/evaluer'
      window.location.href = target
    } catch {
      setError('Erreur de connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = useCallback((m: Mode) => {
    setMode(m)
    setError('')
    setPassword('')
  }, [])

  return (
    <div className="dsm-split-screen" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ═══ LEFT — Hero Panel ═══ */}
      <div className="dsm-hero-panel lg:w-[52%]">
        <ParticleCanvas />

        {/* Grid overlay */}
        <div className="dsm-hero-grid" />

        {/* Glow orbs */}
        <div className="dsm-orb dsm-orb-gold" />
        <div className="dsm-orb dsm-orb-cobalt" />

        <div className="dsm-hero-content">

          {/* Logo */}
          <div className={`dsm-logo-row ${visible ? 'dsm-anim-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0ms' }}>
            <div className="dsm-logo-icon">
              <div className="dsm-logo-pulse" />
              <Anchor size={18} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="dsm-eyebrow">Direction des Solutions Maritimes</p>
              <p className="dsm-brand-name">DSM <span className="dsm-gold">TAMIS</span></p>
            </div>
          </div>

          {/* Badge */}
          <div className={`${visible ? 'dsm-anim-fade-up' : 'opacity-0'}`} style={{ animationDelay: '80ms' }}>
            <span className="dsm-official-badge">
              <ShieldCheck size={13} />
              Plateforme Officielle
            </span>
          </div>

          {/* Headline */}
          <div className={`dsm-headline-block ${visible ? 'dsm-anim-fade-up' : 'opacity-0'}`} style={{ animationDelay: '150ms' }}>
            <h1 className="dsm-headline">
              <span className="dsm-gold dsm-gold-shine">TAMIS</span>
              <br />
              <span className="dsm-headline-sub">{campaignLabel || 'des Agents DSM'}</span>
            </h1>
            <p className="dsm-sub" style={{ color: '#D4AF37' }}>
              Reconnaissance et Valorisation des compétences de nos agents.
            </p>
          </div>

          {/* Stat pills with live counters */}
          <div className={`dsm-stats-row ${visible ? 'dsm-anim-fade-up' : 'opacity-0'}`} style={{ animationDelay: '250ms' }}>
            <div className="dsm-stat-pill-v2">
              <div className="dsm-stat-icon" style={{ background: 'rgba(7,95,172,0.3)' }}>
                <Users size={15} color="white" />
              </div>
              <div>
                <p className="dsm-stat-num">{agentCount}</p>
                <p className="dsm-stat-lbl">{agentCount > 1 ? 'Agents évalués' : 'Agent évalué'}</p>
              </div>
            </div>
            <div className="dsm-stat-pill-v2">
              <div className="dsm-stat-icon" style={{ background: 'rgba(212,175,55,0.25)' }}>
                <TrendingUp size={15} color="#D4AF37" />
              </div>
              <div>
                <p className="dsm-stat-num">{campagneCount}</p>
                <p className="dsm-stat-lbl">{campagneCount > 1 ? 'Campagnes actives' : 'Campagne active'}</p>
              </div>
            </div>
            <div className="dsm-stat-pill-v2">
              <div className="dsm-stat-icon" style={{ background: 'rgba(0,125,85,0.3)' }}>
                <Star size={15} color="white" />
              </div>
              <div>
                <p className="dsm-stat-num">{scoreCount}<span>%</span></p>
                <p className="dsm-stat-lbl">Taux de complétion</p>
              </div>
            </div>
          </div>

          {/* Feature ticker */}
          <div className={`dsm-ticker-wrap ${visible ? 'dsm-anim-fade-up' : 'opacity-0'}`} style={{ animationDelay: '350ms' }}>
            <div className="dsm-ticker">
              {[
                { icon: <Zap size={12} />, label: 'Notation multi-critères' },
                { icon: <Globe size={12} />, label: 'Accès mobile' },
                { icon: <ShieldCheck size={12} />, label: 'Données sécurisées' },
                { icon: <CheckCircle2 size={12} />, label: 'Scores anonymisés' },
                { icon: <Award size={12} />, label: 'Rapports en temps réel' },
                { icon: <Zap size={12} />, label: 'Notation multi-critères' },
                { icon: <Globe size={12} />, label: 'Accès mobile' },
                { icon: <ShieldCheck size={12} />, label: 'Données sécurisées' },
                { icon: <CheckCircle2 size={12} />, label: 'Scores anonymisés' },
                { icon: <Award size={12} />, label: 'Rapports en temps réel' },
              ].map((item, i) => (
                <span key={i} className="dsm-ticker-item">
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* Admin link */}
          <Link
            href="/admin"
            onClick={handleAdminClick}
            className={`dsm-admin-link ${visible ? 'dsm-anim-fade-up' : 'opacity-0'}`}
            style={{ animationDelay: '420ms' }}
          >
            <LayoutDashboard size={15} />
            Espace Administrateur
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* QR Code + Footer */}
        <div className="dsm-hero-footer">
          <div className={`dsm-qr-card-v2 ${visible ? 'dsm-anim-fade-up' : 'opacity-0'}`} style={{ animationDelay: '500ms' }}>
            <div className="dsm-qr-wrap">
              <DynamicQR value={evaluationUrl} size={68} level="H" fgColor="#00182f" />
            </div>
            <div>
              <div className="dsm-qr-title">
                <Smartphone size={13} color="#D4AF37" />
                Accès Mobile
              </div>
              <p className="dsm-qr-sub">Scannez le QR code pour accéder depuis votre téléphone</p>
            </div>
          </div>
          <p className="dsm-watermark">© 2026 DSM Intelligence • Système de Notation des Agents</p>
        </div>
      </div>

      {/* ═══ RIGHT — Form Panel ═══ */}
      <div className="dsm-form-panel lg:w-[48%] flex items-center justify-center p-6 sm:p-12 bg-slate-50/50">
        {/* Card */}
        <div className="w-full max-w-[420px] bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-100/90 space-y-6">

          {/* Logo badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#b58b16] flex items-center justify-center text-white shadow-md shadow-amber-900/10 shrink-0">
              <Anchor size={17} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-[#002d50]">
              DSM <span className="text-[#b58b16]">TAMIS</span>
            </span>
          </div>

          {/* Subtitle */}
          <div>
            <p className="text-sm font-medium text-slate-500 mt-1.5">
              {mode === 'register'
                ? 'Remplissez votre matricule pour accéder au questionnaire.'
                : 'Connectez-vous pour participer aux évaluations.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-4">
            {/* MATRICULE input */}
            <div className="bg-[#eef4fa] rounded-2xl p-3.5 px-4 flex items-center justify-between border border-transparent focus-within:border-[#075fac] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#075fac]/10 transition-all">
              <div className="flex-1 min-w-0">
                <label htmlFor="form-matricule" className="text-[10px] font-black tracking-wider text-[#004b87] uppercase block mb-0.5">
                  Matricule
                </label>
                <input
                  id="form-matricule"
                  type="text"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  placeholder="0000"
                  disabled={loading}
                  required
                  className="w-full bg-transparent border-0 p-0 text-base font-bold text-slate-900 placeholder:text-slate-400 outline-none tracking-wider"
                  autoComplete="username"
                />
              </div>
              <User className="w-5 h-5 text-slate-400 shrink-0 ml-3" />
            </div>

            {/* MOT DE PASSE input */}
            <div className="bg-[#eef4fa] rounded-2xl p-3.5 px-4 flex items-center justify-between border border-transparent focus-within:border-[#075fac] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#075fac]/10 transition-all">
              <div className="flex-1 min-w-0">
                <label htmlFor="form-password" className="text-[10px] font-black tracking-wider text-[#004b87] uppercase block mb-0.5">
                  Matricule
                </label>
                <input
                  id="form-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="0000"
                  disabled={loading}
                  required
                  maxLength={mode === 'register' ? 4 : undefined}
                  inputMode={mode === 'register' ? 'numeric' : 'text'}
                  pattern={mode === 'register' ? '[0-9]*' : undefined}
                  className="w-full bg-transparent border-0 p-0 text-base font-bold text-slate-900 placeholder:text-slate-400 outline-none tracking-wider"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 shrink-0 ml-3"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                <ShieldAlert size={16} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#002d50] hover:bg-[#001d36] text-white py-4 px-6 rounded-2xl font-bold text-base shadow-xl shadow-blue-950/20 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-3 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Traitement en cours…</span>
                </>
              ) : (
                <>
                  <span>{mode === 'register' ? 'Commencer' : 'Se connecter'}</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>

          </form>

        </div>
      </div>
    </div>
  )
}
