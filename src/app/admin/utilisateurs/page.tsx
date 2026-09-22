'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Plus, User, Mail, Building2, ChevronRight, BadgeCheck, ShieldAlert, UserCog, FileSpreadsheet, Upload, X, Loader2, CheckCircle2, KeyRound, Copy, Check, Trash2, QrCode, Printer, Sparkles, ExternalLink } from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'

const DynamicQR = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false })

interface Utilisateur {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
  role: string
  service?: string | null
  departement?: string | null
  direction?: string | null
  qrcodeActif?: boolean
  qrToken?: string | null
  site: { nom: string } | null
}

export default function UtilisateursPage() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success?: boolean; message?: string } | null>(null)
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearResult, setClearResult] = useState<{ success?: boolean; message?: string } | null>(null)
  const [showUniqueQrModal, setShowUniqueQrModal] = useState(false)
  const [qrCopied, setQrCopied] = useState(false)
  const [togglingQrId, setTogglingQrId] = useState<string | null>(null)
  const [batchActivating, setBatchActivating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Recherche : les 2 premières colonnes (Collaborateur, Matricule) sont des champs filtrables
  const [searchNom, setSearchNom] = useState('')
  const [searchMatricule, setSearchMatricule] = useState('')

  const [otpModal, setOtpModal] = useState<{
    open: boolean
    loading: boolean
    code?: string
    agent?: { matricule: string; nom: string; prenom: string }
    expiresAt?: string
    copied: boolean
  }>({ open: false, loading: false, copied: false })

  const generateOtp = async (user: Utilisateur) => {
    setOtpModal({ open: true, loading: true, copied: false })
    try {
      const res = await fetch('/api/admin/otp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: user.matricule }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Erreur lors de la génération du code')
        setOtpModal({ open: false, loading: false, copied: false })
        return
      }
      setOtpModal({ open: true, loading: false, code: data.code, agent: data.agent, expiresAt: data.expiresAt, copied: false })
    } catch {
      alert('Erreur de connexion')
      setOtpModal({ open: false, loading: false, copied: false })
    }
  }

  const fetchUsers = () => {
    setLoading(true)
    fetch('/api/admin/utilisateurs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUtilisateurs(data)
        } else {
          setUtilisateurs([])
        }
      })
      .catch(() => setUtilisateurs([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const toggleQrForUser = async (user: Utilisateur) => {
    setTogglingQrId(user.id)
    try {
      const newStatus = !user.qrcodeActif
      const res = await fetch(`/api/admin/utilisateurs/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrcodeActif: newStatus })
      })
      if (res.ok) {
        const updated = await res.json()
        setUtilisateurs(prev => prev.map(u => u.id === user.id ? { ...u, qrcodeActif: updated.qrcodeActif } : u))
      } else {
        alert('Erreur lors de la modification du statut QR Code')
      }
    } catch {
      alert('Erreur de communication avec le serveur')
    } finally {
      setTogglingQrId(null)
    }
  }

  const handleActivateAllQr = async (enable: boolean) => {
    setBatchActivating(true)
    try {
      const res = await fetch('/api/admin/utilisateurs/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableAllAgents: enable })
      })
      if (res.ok) {
        fetchUsers()
      } else {
        alert('Erreur lors de la mise à jour des agents')
      }
    } catch {
      alert('Erreur réseau')
    } finally {
      setBatchActivating(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/utilisateurs/import', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setImportResult({ success: true, message: data.message })
        fetchUsers()
      } else {
        setImportResult({ success: false, message: data.error })
      }
    } catch (err) {
      setImportResult({ success: false, message: "Une erreur est survenue lors de l'envoi." })
    } finally {
      setImporting(false)
    }
  }

  const [clearing, setClearing] = useState(false)

  const executeClearParticipants = async () => {
    setClearing(true)
    setClearResult(null)
    try {
      const res = await fetch('/api/admin/utilisateurs', {
        method: 'DELETE'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setClearResult({ success: true, message: `${data.count} participants supprimés de la base de données.` })
        fetchUsers()
      } else {
        setClearResult({ success: false, message: data.error || 'Erreur lors de la suppression' })
      }
    } catch {
      setClearResult({ success: false, message: 'Erreur réseau lors de la suppression' })
    } finally {
      setClearing(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            <ShieldAlert className="w-3 h-3" /> ADMIN
          </span>
        )
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-600 border border-purple-100">
            <UserCog className="w-3 h-3" /> MANAGER
          </span>
        )
      case 'EXTERNE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            EXTERNE
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
            <BadgeCheck className="w-3 h-3" /> AGENT
          </span>
        )
    }
  }

  const activeQrCount = utilisateurs.filter(u => u.qrcodeActif && u.role !== 'EXTERNE' && u.role !== 'ADMIN').length
  const uniqueQrUrl = typeof window !== 'undefined' ? `${window.location.origin}/qr` : 'https://notation-agent-dsm.vercel.app/qr'

  // Filtrage par les champs de recherche des 2 premières colonnes
  const filteredUtilisateurs = utilisateurs.filter(u => {
    const nomOk = `${u.nom} ${u.prenom}`.toLowerCase().includes(searchNom.trim().toLowerCase())
    const matOk = u.matricule.toLowerCase().includes(searchMatricule.trim().toLowerCase())
    return nomOk && matOk
  })

  if (loading && utilisateurs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Gestion des Utilisateurs" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div>
                <p className="text-slate-500 font-medium">Gérez les accès, les rôles et les affectations de vos collaborateurs.</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button 
                  onClick={() => { setShowClearModal(true); setClearResult(null); }}
                  disabled={clearing}
                  className="inline-flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-sm disabled:opacity-50"
                >
                  {clearing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Vider...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Vider
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Importer
                </button>
                <Link 
                  href="/admin/utilisateurs/new" 
                  className="inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-100 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Nouvel utilisateur
                </Link>
              </div>
            </div>

            {/* Quick banner about the Unique QR code */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-400 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-950 text-sm">QR Code Unique de Notation Client</h4>
                  <p className="text-xs text-amber-800/80">
                    Ce QR code unique est scanné par vos clients externes. Il leur permet de noter l'ensemble des agents dont la case <strong>« Noter par QR code »</strong> est cochée ci-dessous.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleActivateAllQr(true)}
                  disabled={batchActivating}
                  className="text-xs font-bold px-3 py-2 bg-white border border-amber-300 text-amber-900 rounded-xl hover:bg-amber-100 transition-colors shadow-sm disabled:opacity-50"
                >
                  {batchActivating ? 'Activation...' : 'Cocher tous les agents'}
                </button>
                <button
                  onClick={() => setShowUniqueQrModal(true)}
                  className="text-xs font-bold px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-sm"
                >
                  Voir / Imprimer le QR
                </button>
              </div>
            </div>

            <div className="glass rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-6 py-3">
                        <input
                          type="text"
                          value={searchNom}
                          onChange={e => setSearchNom(e.target.value)}
                          placeholder="Collaborateur"
                          className="w-full min-w-[180px] px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-lg outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-slate-400 transition"
                        />
                      </th>
                      <th className="px-6 py-3">
                        <input
                          type="text"
                          value={searchMatricule}
                          onChange={e => setSearchMatricule(e.target.value)}
                          placeholder="Matricule"
                          className="w-full min-w-[110px] px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-lg outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-slate-400 transition"
                        />
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Site</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rôle</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Noter par QR code</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUtilisateurs.map((user) => (
                      <tr key={user.id} className="hover:bg-brand-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 premium-gradient rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm group-hover:scale-110 transition-transform">
                              {user.nom[0]}{user.prenom[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{user.nom} {user.prenom}</span>
                              {user.service && (
                                <span className="text-xs text-slate-400 font-medium">{user.service}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {user.matricule}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium">{user.site?.nom || user.departement || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getRoleBadge(user.role)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {user.role !== 'EXTERNE' && user.role !== 'ADMIN' ? (
                            <button
                              onClick={() => toggleQrForUser(user)}
                              disabled={togglingQrId === user.id}
                              title={user.qrcodeActif ? "Coché : L'agent sera noté via le QR code" : "Décoché : Cliquez pour inclure cet agent dans la notation QR"}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                                user.qrcodeActif
                                  ? 'bg-amber-100 border border-amber-300 text-amber-900 hover:bg-amber-200'
                                  : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {togglingQrId === user.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                              ) : (
                                <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                                  user.qrcodeActif ? 'bg-amber-500 border-amber-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {user.qrcodeActif && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              )}
                              <span>{user.qrcodeActif ? 'Inclus' : 'Exclu'}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => generateOtp(user)}
                              title="Générer un code de connexion OTP"
                              className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-bold text-sm bg-amber-50 px-3 py-1.5 rounded-lg transition-colors border border-amber-100 hover:border-amber-200"
                            >
                              <KeyRound className="w-3.5 h-3.5" /> OTP
                            </button>
                            <Link 
                              href={`/admin/utilisateurs/${user.id}`} 
                              className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-bold text-sm bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Éditer <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUtilisateurs.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-40">
                            <User className="w-12 h-12" />
                            <p className="text-slate-500 font-medium">Aucun collaborateur ne correspond à la recherche.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>

      {/* UNIQUE GLOBAL QR CODE MODAL */}
      {showUniqueQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowUniqueQrModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 print:m-0 print:border-none print:shadow-none" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500 to-amber-600 text-white print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-white">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">QR Code Unique de Notation</h3>
                  <p className="text-xs text-white/80">Pour l'évaluation par les clients externes</p>
                </div>
              </div>
              <button onClick={() => setShowUniqueQrModal(false)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-8 flex flex-col items-center text-center space-y-5">
              <div className="space-y-1">
                <p className="text-xs uppercase font-extrabold tracking-wider text-amber-600">DSM Notation & Performance</p>
                <h4 className="text-xl font-black text-slate-900">Scannez pour évaluer nos agents</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Chaque client externe accède à la liste des <strong>{activeQrCount} agents concernés</strong> et attribue sa note en toute sécurité.
                </p>
              </div>

              {/* QR Code Container */}
              <div className="p-5 bg-white rounded-3xl shadow-xl border-4 border-amber-400 flex flex-col items-center justify-center">
                <DynamicQR 
                  value={uniqueQrUrl}
                  size={210} 
                  level="H" 
                  fgColor="#00182f" 
                />
                <p className="text-[11px] font-bold text-slate-400 mt-2 font-mono tracking-wide">
                  notation-agent-dsm.vercel.app/qr
                </p>
              </div>

              <div className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 select-all truncate text-left print:hidden">
                {uniqueQrUrl}
              </div>

              <div className="flex gap-3 w-full print:hidden">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(uniqueQrUrl)
                    setQrCopied(true)
                    setTimeout(() => setQrCopied(false), 2000)
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                >
                  {qrCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {qrCopied ? 'Lien copié !' : 'Copier le lien'}
                </button>
                <button
                  onClick={() => {
                    window.print()
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow transition-all active:scale-95"
                  title="Imprimer l'affiche pour affichage à l'accueil"
                >
                  <Printer className="w-4 h-4" /> Imprimer
                </button>
                <button
                  onClick={() => {
                    window.open('/qr', '_blank')
                  }}
                  className="inline-flex items-center justify-center p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                  title="Tester la page client"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-display font-bold text-slate-900">Charger des participants</h3>
              <button onClick={() => { setShowImportModal(false); setImportResult(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8">
              {!importResult ? (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <p className="text-slate-500 font-medium">Sélectionnez le fichier Excel (.xlsx) contenant la liste des participants.</p>
                    <p className="text-xs text-slate-400 italic">Colonnes attendues : Nom, Prénom, Matricule/Tel, Service, Département, Direction, Statut.</p>
                  </div>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                      importing ? 'bg-slate-50 border-slate-200' : 'hover:border-brand-500 hover:bg-brand-50/30 border-slate-200'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImport} 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      disabled={importing}
                    />
                    {importing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
                        <span className="text-sm font-bold text-brand-600">Importation en cours...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-500">
                          <Upload className="w-8 h-8" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-700">Cliquez pour parcourir</p>
                          <p className="text-xs text-slate-400">Excel ou CSV supporté</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-6 py-4">
                  <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${importResult.success ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                    {importResult.success ? <CheckCircle2 className="w-12 h-12" /> : <ShieldAlert className="w-12 h-12" />}
                  </div>
                  <div className="space-y-2">
                    <h4 className={`text-xl font-bold ${importResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                      {importResult.success ? 'Import réussi' : 'Échec de l\'import'}
                    </h4>
                    <p className="text-slate-500 font-medium">{importResult.message}</p>
                  </div>
                  <button 
                    onClick={() => { setShowImportModal(false); setImportResult(null); }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg"
                  >
                    Fermer
                  </button>
                </div>
              )}
            </div>
            
            {!importResult && (
              <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                <Link href="/templates/modele-import-agents.xlsx" className="text-xs font-bold text-brand-600 hover:underline">Télécharger le modèle Excel (7 colonnes)</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OTP Modal */}
      {otpModal.open && (
        <div className="dsm-otp-modal-overlay" onClick={() => setOtpModal(s => ({ ...s, open: false }))}>
          <div className="dsm-otp-modal" onClick={e => e.stopPropagation()}>
            <div className="dsm-otp-modal-header">
              <span className="dsm-otp-modal-title">Code de connexion</span>
              <button onClick={() => setOtpModal(s => ({ ...s, open: false }))} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="dsm-otp-modal-body">
              {otpModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                </div>
              ) : otpModal.code ? (
                <>
                  {otpModal.agent && (
                    <div className="dsm-otp-agent-info">
                      <div className="dsm-otp-agent-avatar">
                        {otpModal.agent.nom[0]}{otpModal.agent.prenom[0]}
                      </div>
                      <div>
                        <p className="dsm-otp-agent-name">{otpModal.agent.nom} {otpModal.agent.prenom}</p>
                        <p className="dsm-otp-agent-matricule">{otpModal.agent.matricule}</p>
                      </div>
                    </div>
                  )}
                  <div className="dsm-otp-code-display">
                    <p className="dsm-otp-code-label">Code à usage unique</p>
                    <p className="dsm-otp-code-value">{otpModal.code}</p>
                    <p className="dsm-otp-code-expiry">
                      Expire à {otpModal.expiresAt ? new Date(otpModal.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  <button
                    className="dsm-otp-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(otpModal.code || '')
                      setOtpModal(s => ({ ...s, copied: true }))
                      setTimeout(() => setOtpModal(s => ({ ...s, copied: false })), 2000)
                    }}
                  >
                    {otpModal.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {otpModal.copied ? 'Copié !' : 'Copier le code'}
                  </button>
                  <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#adb8c9' }}>
                    Communiquez ce code à l’agent. Il est valable 5 minutes.
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Clear Database Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-8">
            {!clearResult ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-100">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-outfit)' }}>Vider les participants</h3>
                  <p className="text-sm text-slate-500" style={{ fontFamily: 'var(--font-inter)' }}>
                    Cette action supprimera **tous les collaborateurs** (sauf les administrateurs) ainsi que toutes leurs évaluations, affectations et notes associées.
                  </p>
                  <p className="text-xs text-red-600 font-bold bg-red-50 p-3 rounded-xl border border-red-100" style={{ fontFamily: 'var(--font-inter)' }}>
                    ⚠ Attention : cette opération est définitive et irréversible !
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={executeClearParticipants}
                    disabled={clearing}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                  >
                    {clearing ? 'Suppression...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-6 py-4">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${clearResult.success ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                  {clearResult.success ? <CheckCircle2 className="w-12 h-12" /> : <ShieldAlert className="w-12 h-12" />}
                </div>
                <div className="space-y-2">
                  <h4 className={`text-xl font-bold ${clearResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {clearResult.success ? 'Nettoyage terminé' : 'Échec du nettoyage'}
                  </h4>
                  <p className="text-slate-500 font-medium">{clearResult.message}</p>
                </div>
                <button 
                  onClick={() => setShowClearModal(false)}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}