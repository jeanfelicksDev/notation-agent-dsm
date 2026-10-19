'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, Save, Trash2, AlertCircle, Calendar, Plus, Pencil, X, Check, 
  ClipboardList, Settings2, Users2, ChevronRight, LayoutDashboard, Search, 
  Activity, Clock, CheckCircle2, Lock, BarChart3, Trophy, Medal, Award, Gift, 
  RefreshCw, Loader2, Target, UserCheck, ArrowLeftRight, FileSpreadsheet, 
  ExternalLink, Building2, FolderGit2, Sparkles, Crown, ListOrdered, Eye, EyeOff, Filter
} from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'
import { confirmer, toast } from '@/components/ui/feedback'
import { getAppreciationInfo } from '@/lib/default-criteres'

interface Critere {
  id: string
  libelle: string
  description: string | null
  noteMaximale: number
  typeEvaluateur: string
  typeEvaluateurs?: string[]
}

interface User {
  id: string
  matricule: string
  nom: string
  prenom: string
  role: string
  service?: string | null
  departement?: string | null
  direction?: string | null
}

export default function CampagneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'config' | 'criteres' | 'affectations' | 'suivi' | 'prix' | 'classement'>('config')

  const [formData, setFormData] = useState({
    libelle: '',
    dateDebut: '',
    dateFin: '',
    poidsCollegues: 45,
    poidsManager: 55,
    poidsClient: 25,
    statut: 'OUVERTE',
    prixGlobal: '',
    prixDirection: '',
    prixDepartement: '',
    prixService: ''
  })

  const [criteres, setCriteres] = useState<Critere[]>([])
  const [showCritereForm, setShowCritereForm] = useState(false)
  const [editingCritere, setEditingCritere] = useState<string | null>(null)
  const [critereSearch, setCritereSearch] = useState('')
  const [critereFilter, setCritereFilter] = useState<'ALL' | 'TOUS' | 'COLLEGUE' | 'MANAGER' | 'CLIENT' | 'CLIENT_INTERNE'>('ALL')
  const [seedingCriteres, setSeedingCriteres] = useState(false)
  const [critereForm, setCritereForm] = useState({
    libelle: '',
    description: '',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE',
    typeEvaluateurs: ['COLLEGUE'] as string[]
  })

  const [allUsers, setAllUsers] = useState<User[]>([])
  const [affectations, setAffectations] = useState<any[]>([])
  const [closing, setClosing] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const handleSeedOfficialCriteres = async () => {
    const ok = await confirmer({
      titre: 'Remplacer les critères par la grille officielle ?',
      message: 'Tous les critères actuels seront supprimés, ainsi que toutes les notes déjà données sur cette campagne. Cette action est irréversible.',
      confirmer: 'Remplacer les critères',
      danger: true,
      saisieRequise: 'REMPLACER',
    })
    if (!ok) return
    setSeedingCriteres(true)
    try {
      const res = await fetch(`/api/admin/campagnes/${id}/seed-criteres`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.criteres) {
        setCriteres(data.criteres)
        toast.success(data.message)
      } else {
        toast.error(data.error || 'La grille officielle n’a pas pu être appliquée.')
      }
    } catch {
      toast.error('Connexion au serveur impossible.')
    } finally {
      setSeedingCriteres(false)
    }
  }

  const loadCriteres = () => {
    fetch(`/api/admin/campagnes/${id}/criteres`)
      .then(res => res.json())
      .then(data => setCriteres(data))
      .catch(() => {})
  }

  const loadUsers = () => {
    fetch('/api/admin/utilisateurs')
      .then(res => res.json())
      .then(data => setAllUsers(data))
  }

  const loadAffectations = () => {
    fetch(`/api/admin/campagnes/${id}/affectations`)
      .then(res => res.json())
      .then(data => setAffectations(data))
  }

  useEffect(() => {
    const onglet = new URLSearchParams(window.location.search).get('onglet')
    if (onglet && ['config', 'criteres', 'affectations', 'suivi', 'prix', 'classement'].includes(onglet)) {
      setActiveTab(onglet as typeof activeTab)
    }
  }, [])

  useEffect(() => {
    fetch(`/api/admin/campagnes/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setFormData({
            libelle: data.libelle || '',
            dateDebut: data.dateDebut ? new Date(data.dateDebut).toISOString().split('T')[0] : '',
            dateFin: data.dateFin ? new Date(data.dateFin).toISOString().split('T')[0] : '',
            poidsCollegues: data.poidsCollegues ?? 45,
            poidsManager: data.poidsManager ?? 55,
            poidsClient: data.poidsClient ?? 25,
            statut: data.statut || 'OUVERTE',
            prixGlobal: data.prixGlobal ?? '',
            prixDirection: data.prixDirection ?? '',
            prixDepartement: data.prixDepartement ?? '',
            prixService: data.prixService ?? ''
          })
        }
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
    loadCriteres()
    loadUsers()
    loadAffectations()
  }, [id])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSaving(true)
    setError('')
    setSaveSuccess(false)

    try {
      const res = await fetch(`/api/admin/campagnes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 4000)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Une erreur est survenue')
      }
    } catch (err) {
      setError('Erreur de connexion')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const ok = await confirmer({
      titre: `Supprimer la campagne « ${formData.libelle} » ?`,
      message: 'Ses critères, affectations, notes et scores seront définitivement supprimés.',
      confirmer: 'Supprimer la campagne',
      danger: true,
      saisieRequise: 'SUPPRIMER',
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/admin/campagnes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Campagne supprimée.')
        router.push('/admin/campagnes')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'La suppression a échoué.')
      }
    } catch {
      toast.error('Connexion au serveur impossible.')
    }
  }

  const handleCloture = async () => {
    const ok = await confirmer({
      titre: 'Clôturer la campagne ?',
      message: 'Les évaluateurs ne pourront plus noter. Le classement sera calculé et enregistré à partir des seules évaluations soumises.',
      confirmer: 'Clôturer et calculer',
    })
    if (!ok) return
    setClosing(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/campagnes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'CLOTUREE' })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setFormData(prev => ({ ...prev, statut: data.statut ?? 'CALCULEE' }))
        toast.success('Campagne clôturée, classement enregistré.')
      } else {
        setError(data.error || 'La clôture a échoué.')
      }
    } catch {
      setError('Connexion au serveur impossible.')
    } finally {
      setClosing(false)
    }
  }

  const handleCalculScores = async () => {
    setCalculating(true)
    setError('')
    try {
      const res = await fetch('/api/admin/classement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campagneId: id })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (data.campagne?.statut) setFormData(prev => ({ ...prev, statut: data.campagne.statut }))
        toast.success('Classement recalculé et enregistré.')
      } else {
        setError(data.error || 'Le calcul des scores a échoué.')
      }
    } catch {
      setError('Connexion au serveur impossible.')
    } finally {
      setCalculating(false)
    }
  }

  const handleRouvrir = async () => {
    const ok = await confirmer({
      titre: 'Rouvrir la campagne ?',
      message: 'Les évaluateurs pourront de nouveau noter. Le classement redeviendra provisoire jusqu’à la prochaine clôture.',
      confirmer: 'Rouvrir',
    })
    if (!ok) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/campagnes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'OUVERTE' })
      })
      if (res.ok) {
        setFormData(prev => ({ ...prev, statut: 'OUVERTE' }))
        toast.success('La campagne est de nouveau ouverte.')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'La réouverture a échoué.')
      }
    } catch {
      setError('Connexion au serveur impossible.')
    } finally {
      setSaving(false)
    }
  }

  const resetCritereForm = () => {
    setCritereForm({ libelle: '', description: '', noteMaximale: 5, typeEvaluateur: 'COLLEGUE', typeEvaluateurs: ['COLLEGUE'] })
    setShowCritereForm(false)
    setEditingCritere(null)
  }

  const handleCritereSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!critereForm.libelle.trim()) return

    try {
      const method = editingCritere ? 'PATCH' : 'POST'
      const url = editingCritere
        ? `/api/admin/campagnes/${id}/criteres/${editingCritere}`
        : `/api/admin/campagnes/${id}/criteres`

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(critereForm)
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Le critère n’a pas pu être enregistré.')
        return
      }
      toast.success(editingCritere ? 'Critère modifié.' : 'Critère ajouté.')
      resetCritereForm()
      loadCriteres()
    } catch {
      toast.error('Connexion au serveur impossible.')
    }
  }

  const handleDeleteCritere = async (critereId: string) => {
    const critere = criteres.find((c) => c.id === critereId)
    const ok = await confirmer({
      titre: `Supprimer le critère « ${critere?.libelle ?? ''} » ?`,
      message: 'Toutes les notes déjà données sur ce critère seront supprimées.',
      confirmer: 'Supprimer le critère',
      danger: true,
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/admin/campagnes/${id}/criteres/${critereId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'La suppression a échoué.')
        return
      }
      toast.success(data.notesSupprimees ? `Critère supprimé (${data.notesSupprimees} note(s) supprimée(s)).` : 'Critère supprimé.')
      loadCriteres()
    } catch {
      toast.error('Connexion au serveur impossible.')
    }
  }

  const startEditCritere = (critere: Critere) => {
    let initialTypeEvaluateurs = critere.typeEvaluateurs || [];
    if (initialTypeEvaluateurs.length === 0 && critere.typeEvaluateur) {
      if (critere.typeEvaluateur === 'TOUS') {
        initialTypeEvaluateurs = ['MANAGER', 'COLLEGUE', 'CLIENT', 'CLIENT_INTERNE'];
      } else {
        initialTypeEvaluateurs = [critere.typeEvaluateur];
      }
    }
    setCritereForm({
      libelle: critere.libelle,
      description: critere.description || '',
      noteMaximale: critere.noteMaximale,
      typeEvaluateur: critere.typeEvaluateur,
      typeEvaluateurs: initialTypeEvaluateurs
    })
    setEditingCritere(critere.id)
    setShowCritereForm(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-navy-100 border-t-brand-500 animate-spin"></div>
      </div>
    )
  }

  const typeLabels: Record<string, string> = {
    COLLEGUE: 'Collègues',
    MANAGER: 'Managers',
    CLIENT: 'Clients externes (QR Code)',
    CLIENT_INTERNE: 'Clients internes',
    TOUS: 'Tous'
  }

  return (
    <div className="contents">
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title={formData.libelle || 'Détails Campagne'} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1780px] w-full mx-auto space-y-6">
            {/* Header / Actions */}
            <div className="flex items-center justify-between">
              <Link href="/admin/campagnes" className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" /> Retour
              </Link>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-all font-bold text-sm"
              >
                <Trash2 className="w-5 h-5" /> Supprimer cette Campagne
              </button>
            </div>

            {/* Navigation Tabs (Compacte, sans élargissement artificiel) */}
            <div className="flex items-center justify-start overflow-x-auto pb-1">
              <div className="inline-flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setActiveTab('config')}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === 'config' ? 'bg-navy-700 text-white shadow-md shadow-navy-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Settings2 className="w-4 h-4" /> Configuration
                </button>
                <button 
                  onClick={() => setActiveTab('criteres')}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === 'criteres' ? 'bg-navy-700 text-white shadow-md shadow-navy-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <ClipboardList className="w-4 h-4" /> Critères ({criteres.length})
                </button>
                <button 
                  onClick={() => setActiveTab('affectations')}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === 'affectations' ? 'bg-navy-700 text-white shadow-md shadow-navy-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Users2 className="w-4 h-4" /> Affectations
                </button>
                <button 
                  onClick={() => setActiveTab('suivi')}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === 'suivi' ? 'bg-navy-700 text-white shadow-md shadow-navy-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Activity className="w-4 h-4" /> Suivi
                </button>
                <button 
                  onClick={() => setActiveTab('prix')}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === 'prix' ? 'bg-navy-700 text-white shadow-md shadow-navy-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Gift className="w-4 h-4" /> Prix & Distinctions
                </button>
                <button 
                  onClick={() => setActiveTab('classement')}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
                    activeTab === 'classement' 
                      ? 'bg-navy-900 text-gold-500 shadow-md border border-gold-500/30' 
                      : 'text-navy-900 hover:bg-amber-50/50 font-black'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-gold-500" /> Classement & Palmarès
                </button>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <p className="font-bold">Modifications enregistrées avec succès !</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-bold">{error}</p>
              </div>
            )}

            {/* Tab Content */}
            <div key={activeTab}>
              {activeTab === 'config' && (
                <div className="bg-white shadow-card rounded-3xl p-8 border border-slate-200/50 shadow-sm space-y-8">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">Paramètres Généraux</h3>
                    <p className="text-slate-500 text-sm font-medium">Définissez les bases de votre campagne d'évaluation.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Libellé de la campagne</label>
                      <input
                        type="text"
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 focus:bg-white transition-all outline-none font-bold text-slate-800"
                        value={formData.libelle}
                        onChange={e => setFormData({ ...formData, libelle: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date de début</label>
                      <div className="relative">
                        <input
                          type="date"
                          required
                          className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 focus:bg-white transition-all outline-none font-bold text-slate-800"
                          value={formData.dateDebut}
                          onChange={e => setFormData({ ...formData, dateDebut: e.target.value })}
                        />
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date de fin</label>
                      <div className="relative">
                        <input
                          type="date"
                          required
                          className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 focus:bg-white transition-all outline-none font-bold text-slate-800"
                          value={formData.dateFin}
                          onChange={e => setFormData({ ...formData, dateFin: e.target.value })}
                        />
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Statut Actuel</label>
                      <select
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 focus:bg-white transition-all outline-none font-bold text-slate-800 cursor-pointer"
                        value={formData.statut}
                        onChange={e => setFormData({ ...formData, statut: e.target.value })}
                      >
                        <option value="OUVERTE">🟢 Ouverte (En cours de notation)</option>
                        <option value="CLOTUREE">🔒 Clôturée (Votes figés)</option>
                        <option value="CALCULEE">📊 Calculée (Scores générés)</option>
                      </select>
                    </div>

                    <div className="space-y-4 md:col-span-2 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Répartition des poids</label>
                        <span className="text-sm font-bold text-navy-800 bg-navy-50 px-3 py-1 rounded-full">Total 100%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-600 block">Collègues (%)</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-black text-navy-800 text-xl"
                            value={formData.poidsCollegues}
                            onChange={e => {
                              const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                              setFormData({ ...formData, poidsCollegues: val, poidsManager: 100 - val })
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-600 block">Manager (%)</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-black text-amber-600 text-xl"
                            value={formData.poidsManager}
                            onChange={e => {
                              const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                              setFormData({ ...formData, poidsManager: val, poidsCollegues: 100 - val })
                            }}
                          />
                        </div>
                        <div className="col-span-2 space-y-2 border-t border-slate-200 pt-4">
                          <label htmlFor="poids-client" className="block text-xs font-bold text-slate-600">
                            Dont clients QR (points pris sur la part collègues)
                          </label>
                          <input
                            id="poids-client"
                            type="number"
                            min="0"
                            max={formData.poidsCollegues}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-semibold text-navy-800 text-lg"
                            value={formData.poidsClient}
                            onChange={e => {
                              const val = Math.min(formData.poidsCollegues, Math.max(0, parseInt(e.target.value) || 0))
                              setFormData({ ...formData, poidsClient: val })
                            }}
                          />
                          <p className="text-xs text-slate-500">
                            Quand un agent a des avis de collègues et de clients : collègues {formData.poidsCollegues - formData.poidsClient} pts,
                            clients {formData.poidsClient} pts. Sinon, la source présente prend les {formData.poidsCollegues} pts.
                            Une source absente compte pour 0.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 pt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100">
                      <div className="flex items-center gap-3 flex-wrap">
                        {formData.statut === 'OUVERTE' && (
                          <>
                            <button
                              type="button"
                              onClick={handleCloture}
                              disabled={closing}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-7 py-3.5 rounded-2xl font-black transition-all active:scale-[0.98] shadow-lg shadow-amber-600/20 disabled:opacity-50 flex items-center gap-2.5 text-sm"
                            >
                              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                              Clôturer la campagne
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCalculScores()}
                              disabled={calculating}
                              className="bg-navy-700 hover:bg-navy-800 text-white px-7 py-3.5 rounded-2xl font-black transition-all active:scale-[0.98] shadow-lg shadow-navy-700/20 disabled:opacity-50 flex items-center gap-2.5 text-sm"
                            >
                              {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                              Calculer les scores
                            </button>
                          </>
                        )}
                        {formData.statut === 'CLOTUREE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCalculScores()}
                              disabled={calculating}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-3.5 rounded-2xl font-black transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2.5 text-sm"
                            >
                              {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                              Calculer les scores
                            </button>
                            <button
                              type="button"
                              onClick={handleRouvrir}
                              disabled={saving}
                              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3.5 rounded-2xl font-bold transition-all text-sm flex items-center gap-2 shadow-sm"
                            >
                              <RefreshCw className="w-4 h-4 text-slate-500" />
                              Rouvrir la campagne
                            </button>
                          </>
                        )}
                        {formData.statut === 'CALCULEE' && (
                          <>
                            <button
                              type="button"
                              onClick={handleCloture}
                              disabled={closing}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3.5 rounded-2xl font-black transition-all active:scale-[0.98] shadow-lg shadow-amber-600/20 disabled:opacity-50 flex items-center gap-2 text-sm"
                            >
                              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                              Clôturer / Figer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCalculScores()}
                              disabled={calculating}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-black transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2 text-sm"
                            >
                              {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              Recalculer les scores
                            </button>
                            <Link
                              href={`/admin/classement?campagneId=${id}`}
                              className="bg-navy-900 hover:bg-navy-950 text-gold-500 border border-gold-500/40 px-6 py-3.5 rounded-2xl font-black text-sm transition-all shadow-md flex items-center gap-2"
                            >
                              <Trophy className="w-4 h-4" />
                              Voir le classement
                            </Link>
                            <button
                              type="button"
                              onClick={handleRouvrir}
                              disabled={saving}
                              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3.5 rounded-2xl font-bold transition-all text-sm flex items-center gap-2 shadow-sm"
                            >
                              Rouvrir la campagne
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-2xl font-black text-base transition-all active:scale-[0.98] shadow-xl disabled:opacity-50 flex items-center gap-2.5"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer les modifications
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'criteres' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-bold text-slate-900">Critères d'évaluation</h3>
                        <span className="bg-navy-50 text-navy-900 text-xs font-black px-2.5 py-0.5 rounded-full border border-navy-100">
                          {criteres.length} critère{criteres.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-slate-500 font-medium text-sm mt-0.5">Définissez sur quels points les agents seront notés (Collègues, Managers, Clients QR).</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleSeedOfficialCriteres}
                        disabled={seedingCriteres}
                        className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all border border-slate-200 shadow-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        {seedingCriteres ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-navy-800" />}
                        <span>Rétablir grille DSM (15 critères)</span>
                      </button>
                      {!showCritereForm && (
                        <button
                          onClick={() => { resetCritereForm(); setShowCritereForm(true) }}
                          className="flex items-center gap-2 bg-navy-700 hover:bg-navy-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-navy-100 transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Ajouter un critère
                        </button>
                      )}
                    </div>
                  </div>

                  {showCritereForm && (
                    <div className="bg-white shadow-card rounded-3xl p-8 border border-navy-200 shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-navy-700"></div>
                      <form onSubmit={handleCritereSubmit} className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-lg font-bold text-slate-900">{editingCritere ? 'Modifier le critère' : 'Nouveau critère'}</h4>
                          <button type="button" onClick={resetCritereForm} className="p-2 hover:bg-slate-100 rounded-full">
                            <X className="w-5 h-5 text-slate-400" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                          <div className="md:col-span-9 xl:col-span-10 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Libellé du critère</label>
                            <input
                              type="text"
                              required
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 outline-none font-bold"
                              value={critereForm.libelle}
                              onChange={e => setCritereForm({ ...critereForm, libelle: e.target.value })}
                              placeholder="Ex: Ponctualité et assiduité"
                            />
                          </div>
                          
                          <div className="md:col-span-3 xl:col-span-2 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Note maximale</label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 outline-none font-bold"
                              value={critereForm.noteMaximale}
                              onChange={e => setCritereForm({ ...critereForm, noteMaximale: parseInt(e.target.value) || 5 })}
                            />
                          </div>
                          
                          <div className="md:col-span-12 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description détaillée</label>
                            <textarea
                              rows={3}
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 outline-none font-medium text-slate-600"
                              value={critereForm.description}
                              onChange={e => setCritereForm({ ...critereForm, description: e.target.value })}
                              placeholder="Décrivez ce que ce critère évalue précisément..."
                            />
                          </div>
                          
                          <div className="md:col-span-12 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Évaluateurs autorisés</label>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                              {[
                                { id: 'MANAGER', label: 'Managers' },
                                { id: 'COLLEGUE', label: 'Collègues' },
                                { id: 'CLIENT_INTERNE', label: 'Clients internes' },
                                { id: 'CLIENT', label: 'Clients externes (QR)' }
                              ].map(role => (
                                <label key={role.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 text-navy-800 rounded focus:ring-navy-700"
                                    checked={critereForm.typeEvaluateurs.includes(role.id)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setCritereForm(prev => {
                                        const newArr = checked 
                                          ? [...prev.typeEvaluateurs, role.id]
                                          : prev.typeEvaluateurs.filter(r => r !== role.id);
                                        return { ...prev, typeEvaluateurs: newArr };
                                      });
                                    }}
                                  />
                                  <span className="text-sm font-bold text-slate-700">{role.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={resetCritereForm}
                            className="px-6 py-3 border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition-all"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center gap-2"
                          >
                            {editingCritere ? <><Check className="w-5 h-5" /> Mettre à jour</> : <><Plus className="w-5 h-5" /> Ajouter au référentiel</>}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Barre de recherche et filtres pour les critères */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Filtrer les critères..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-navy-700 focus:bg-white outline-none text-xs font-semibold"
                        value={critereSearch}
                        onChange={e => setCritereSearch(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                      <button
                        onClick={() => setCritereFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          critereFilter === 'ALL'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tous ({criteres.length})
                      </button>
                      <button
                        onClick={() => setCritereFilter('TOUS')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          critereFilter === 'TOUS'
                            ? 'bg-navy-800 text-white shadow-sm'
                            : 'bg-navy-50 text-navy-900 hover:bg-navy-100'
                        }`}
                      >
                        Tous évaluateurs ({criteres.filter(c => c.typeEvaluateur === 'TOUS').length})
                      </button>
                      <button
                        onClick={() => setCritereFilter('COLLEGUE')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          critereFilter === 'COLLEGUE'
                            ? 'bg-navy-700 text-white shadow-sm'
                            : 'bg-navy-50 text-navy-800 hover:bg-navy-100'
                        }`}
                      >
                        Collègues ({criteres.filter(c => c.typeEvaluateur === 'COLLEGUE').length})
                      </button>
                      <button
                        onClick={() => setCritereFilter('MANAGER')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          critereFilter === 'MANAGER'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                        }`}
                      >
                        Managers ({criteres.filter(c => c.typeEvaluateur === 'MANAGER').length})
                      </button>
                      <button
                        onClick={() => setCritereFilter('CLIENT')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          critereFilter === 'CLIENT'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        Clients QR ({criteres.filter(c => c.typeEvaluateur === 'CLIENT').length})
                      </button>
                      <button
                        onClick={() => setCritereFilter('CLIENT_INTERNE')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          critereFilter === 'CLIENT_INTERNE'
                            ? 'bg-pink-600 text-white shadow-sm'
                            : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
                        }`}
                      >
                        Clients internes ({criteres.filter(c => c.typeEvaluateur === 'CLIENT_INTERNE').length})
                      </button>
                    </div>
                  </div>

                  {/* Conteneur avec ascenseur (scrollbar visible) */}
                  <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-2">
                    {criteres
                      .filter(c => {
                        const matchesSearch =
                          c.libelle.toLowerCase().includes(critereSearch.toLowerCase()) ||
                          (c.description && c.description.toLowerCase().includes(critereSearch.toLowerCase()))
                        const matchesFilter =
                          critereFilter === 'ALL' ||
                          c.typeEvaluateur === critereFilter
                        return matchesSearch && matchesFilter
                      })
                      .map((critere, index) => (
                        <div 
                          key={critere.id} 
                          className="bg-white shadow-card rounded-2xl border border-slate-200/70 p-5 flex items-center justify-between group shadow-sm bg-white"
                         
                        >
                          <div className="flex-1 pr-4">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h4 className="text-base font-bold text-slate-900">{critere.libelle}</h4>
                              <span className="px-2.5 py-0.5 rounded-full bg-navy-50 text-navy-800 text-xs font-black border border-navy-100">
                                Note: 0 à {critere.noteMaximale}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                                critere.typeEvaluateur === 'MANAGER'
                                  ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                  : critere.typeEvaluateur === 'CLIENT'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : critere.typeEvaluateur === 'TOUS'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-navy-100 text-navy-900 border border-navy-200'
                              }`}>
                                {typeLabels[critere.typeEvaluateur] || critere.typeEvaluateur}
                              </span>
                            </div>
                            {critere.description && (
                              <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">{critere.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => startEditCritere(critere)}
                              className="p-2 text-slate-400 hover:text-navy-800 hover:bg-navy-50 rounded-xl transition-all"
                              title="Modifier ce critère"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCritere(critere.id)}
                              className="p-2 text-red-700/60 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                              title="Supprimer ce critère"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    {criteres.length === 0 && !showCritereForm && (
                      <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300">
                        <div className="flex flex-col items-center gap-3 opacity-40">
                          <ClipboardList className="w-12 h-12" />
                          <div className="space-y-1">
                            <p className="text-lg font-bold">Aucun critère</p>
                            <p className="text-xs text-slate-500">Ajoutez un critère ou cliquez sur « Rétablir grille DSM ».</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'affectations' && (
                <AffectationsManager 
                  campagneId={id} 
                  users={allUsers} 
                  initialAffectations={affectations}
                  onUpdate={loadAffectations}
                />
              )}

              {activeTab === 'suivi' && (
                <SuiviDashboard affectations={affectations} users={allUsers} />
              )}

              {activeTab === 'prix' && (
                <div className="bg-white shadow-card rounded-3xl p-8 border border-slate-200/50 shadow-sm space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs uppercase tracking-widest">
                        <Trophy className="w-4 h-4" /> Récompenses & Palmarès Officiels
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900">Grille des Prix & Distinctions</h3>
                      <p className="text-slate-500 text-sm font-medium">Définissez les 3 paliers officiels de distinctions : Direction (Super Lauréat), Département et Service.</p>
                    </div>

                  </div>

                  {/* Summary preview cards (3 Paliers Officiels) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Super Lauréat Direction */}
                    <div className="bg-gold-50 border border-gold-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase tracking-wider">
                          <Trophy className="w-4 h-4 text-amber-600 flex-shrink-0" /> Super Lauréat Direction DSM
                        </div>
                        <p className="text-sm font-black text-amber-950 mt-2 line-clamp-2">
                          {formData.prixDirection || formData.prixGlobal || "Non configuré"}
                        </p>
                      </div>
                      <span className="text-[10px] text-amber-800 font-black mt-3 bg-amber-200/80 px-2.5 py-1 rounded-md w-fit">1er Prix • Niveau Direction</span>
                    </div>

                    {/* 2. Prix Département */}
                    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-teal-700 font-black text-xs uppercase tracking-wider">
                          <Medal className="w-4 h-4 text-teal-600 flex-shrink-0" /> Meilleur Agent par Département
                        </div>
                        <p className="text-sm font-bold text-teal-950 mt-2 line-clamp-2">
                          {formData.prixDepartement || "Non configuré"}
                        </p>
                      </div>
                      <span className="text-[10px] text-teal-700 font-black mt-3 bg-teal-100 px-2.5 py-1 rounded-md w-fit">2ème Prix • Niveau Département</span>
                    </div>

                    {/* 3. Prix Service / Cellule */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-700 font-black text-xs uppercase tracking-wider">
                          <Gift className="w-4 h-4 text-emerald-600 flex-shrink-0" /> Meilleur Agent de Service
                        </div>
                        <p className="text-sm font-bold text-emerald-950 mt-2 line-clamp-2">
                          {formData.prixService || "Non configuré"}
                        </p>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-black mt-3 bg-emerald-100 px-2.5 py-1 rounded-md w-fit">3ème Prix • Niveau Service / Cellule</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Form Cards (3 Paliers) */}
                    <div className="grid grid-cols-1 gap-6">
                      {/* 1. Super Lauréat Direction */}
                      <div className="p-6 bg-white rounded-2xl border border-amber-200/80 shadow-sm space-y-3 relative overflow-hidden">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
                            <Trophy className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-slate-900 text-base">Super Lauréat de la Direction (Meilleur Agent Direction DSM)</h4>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">Palier 1</span>
                            </div>
                            <p className="text-xs text-slate-500">Premier de la direction</p>
                          </div>
                        </div>
                        <div className="space-y-1.5 pt-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description du Prix & Dotation Direction</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-500 focus:bg-white transition-all outline-none font-bold text-slate-800"
                            placeholder="Ex. : Trophée d’excellence + prime"
                            value={formData.prixDirection || formData.prixGlobal}
                            onChange={e => {
                              const val = e.target.value
                              setFormData({ ...formData, prixDirection: val, prixGlobal: val })
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 2. Prix Département */}
                        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative overflow-hidden">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold flex-shrink-0">
                              <Medal className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 text-base">Meilleur Agent par Département</h4>
                                <span className="text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">Palier 2</span>
                              </div>
                              <p className="text-xs text-slate-500">Premier de chaque département</p>
                            </div>
                          </div>
                          <div className="space-y-1.5 pt-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description du Prix & Dotation Département</label>
                            <input
                              type="text"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 focus:bg-white transition-all outline-none font-bold text-slate-800"
                              placeholder="Ex. : Certificat de mérite + prime"
                              value={formData.prixDepartement}
                              onChange={e => setFormData({ ...formData, prixDepartement: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* 3. Prix Service / Cellule */}
                        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative overflow-hidden">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">
                              <Gift className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 text-base">Meilleur Agent de Service / Cellule</h4>
                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Palier 3</span>
                              </div>
                              <p className="text-xs text-slate-500">Major de chaque cellule de travail</p>
                            </div>
                          </div>
                          <div className="space-y-1.5 pt-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description du Prix & Dotation Service</label>
                            <input
                              type="text"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold text-slate-800"
                              placeholder="Ex: Tableau d'honneur"
                              value={formData.prixService}
                              onChange={e => setFormData({ ...formData, prixService: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-xl disabled:opacity-50 flex items-center gap-3"
                      >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Enregistrer la grille des 3 prix
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'classement' && (
                <ClassementCampagneView 
                  campagneId={id} 
                  formData={formData} 
                  onRecalculate={() => handleCalculScores()} 
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function AffectationsManager({ campagneId, users, initialAffectations, onUpdate }: { campagneId: string, users: User[], initialAffectations: any[], onUpdate: () => void }) {
  const [perspective, setPerspective] = useState<'BY_EVALUE' | 'BY_EVALUATEUR'>('BY_EVALUE')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'PAIR' | 'MANAGER' | 'EXTERNE'>('ALL')
  const [sortOrder, setSortOrder] = useState<'name_asc' | 'role' | 'count_desc'>('name_asc')
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [targetSearch, setTargetSearch] = useState('')
  const [targetCategory, setTargetCategory] = useState<'ALL' | 'PAIR' | 'MANAGER' | 'EXTERNE'>('ALL')
  const [targetSort, setTargetSort] = useState<'name_asc' | 'role'>('name_asc')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  // Calcule les cibles courantes selon la perspective
  useEffect(() => {
    if (!selectedUser) {
      setTargets([])
      return
    }
    if (perspective === 'BY_EVALUE') {
      // Pour le noté sélectionné, qui sont ses évaluateurs ? (exclut strictement le noté lui-même)
      const currentEvaluators = initialAffectations
        .filter(a => a.evalueId === selectedUser.id && a.evaluateurId !== selectedUser.id)
        .map(a => a.evaluateurId)
      setTargets(currentEvaluators)
    } else {
      // Pour l'évaluateur sélectionné, qui sont ses notés ? (exclut strictement l'évaluateur lui-même)
      const currentEvalues = initialAffectations
        .filter(a => a.evaluateurId === selectedUser.id && a.evalueId !== selectedUser.id)
        .map(a => a.evalueId)
      setTargets(currentEvalues)
    }
  }, [selectedUser, perspective, initialAffectations])

  const getRoleCategory = (role: string): 'PAIR' | 'MANAGER' | 'EXTERNE' | 'ADMIN' => {
    if (role === 'MANAGER') return 'MANAGER'
    if (role === 'EXTERNE') return 'EXTERNE'
    if (role === 'ADMIN') return 'ADMIN'
    return 'PAIR'
  }

  const getCategoryLabel = (role: string) => {
    switch (role) {
      case 'MANAGER':
        return { label: 'Manager', badge: 'bg-teal-100 text-teal-800 border-teal-200' }
      case 'EXTERNE':
        return { label: 'Client Ext.', badge: 'bg-amber-100 text-amber-800 border-amber-200' }
      case 'ADMIN':
        return { label: 'Admin', badge: 'bg-red-100 text-red-800 border-red-200' }
      default:
        return { label: 'Pair (Collaborateur)', badge: 'bg-navy-100 text-navy-900 border-navy-200' }
    }
  }

  // Règle métier DSM : seuls les collaborateurs pairs sont notés (ni managers, ni clients externes, ni admins)
  const isNoteEligible = (u: User) => u.role !== 'MANAGER' && u.role !== 'EXTERNE' && u.role !== 'ADMIN'

  // Liste de gauche (selon perspective)
  const baseLeftUsers = perspective === 'BY_EVALUE'
    ? users.filter(isNoteEligible)
    : users

  const filteredLeftUsers = baseLeftUsers
    .filter(u => {
      const matchesSearch =
        u.nom.toLowerCase().includes(search.toLowerCase()) || 
        u.prenom.toLowerCase().includes(search.toLowerCase()) ||
        u.matricule.toLowerCase().includes(search.toLowerCase()) ||
        (u.service && u.service.toLowerCase().includes(search.toLowerCase())) ||
        (u.departement && u.departement.toLowerCase().includes(search.toLowerCase()))

      const cat = getRoleCategory(u.role)
      const matchesCat = perspective === 'BY_EVALUE' || categoryFilter === 'ALL' || cat === categoryFilter

      return matchesSearch && matchesCat
    })
    .sort((a, b) => {
      if (sortOrder === 'name_asc') {
        return a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)
      }
      if (sortOrder === 'role') {
        const order: Record<string, number> = { MANAGER: 1, UTILISATEUR: 2, EXTERNE: 3, ADMIN: 4 }
        return (order[a.role] || 99) - (order[b.role] || 99) || a.nom.localeCompare(b.nom)
      }
      if (sortOrder === 'count_desc') {
        const countA = perspective === 'BY_EVALUE'
          ? initialAffectations.filter(x => x.evalueId === a.id).length
          : initialAffectations.filter(x => x.evaluateurId === a.id).length
        const countB = perspective === 'BY_EVALUE'
          ? initialAffectations.filter(x => x.evalueId === b.id).length
          : initialAffectations.filter(x => x.evaluateurId === b.id).length
        return countB - countA || a.nom.localeCompare(b.nom)
      }
      return 0
    })

  // Compteurs pour la liste de gauche
  const countPairs = baseLeftUsers.filter(u => getRoleCategory(u.role) === 'PAIR').length
  const countManagers = baseLeftUsers.filter(u => getRoleCategory(u.role) === 'MANAGER').length
  const countExternes = baseLeftUsers.filter(u => getRoleCategory(u.role) === 'EXTERNE').length

  // Liste de droite (les personnes à cocher)
  // RÈGLE ABSOLUE : INTERDICTION DE L'AUTO-ÉVALUATION (u.id !== selectedUser?.id)
  const baseRightUsers = (perspective === 'BY_EVALUE'
    ? users
    : users.filter(isNoteEligible)
  ).filter(u => selectedUser ? (u.id !== selectedUser.id && u.matricule !== selectedUser.matricule) : true)

  const filteredRightUsers = baseRightUsers
    .filter(u => {
      const matchesSearch =
        u.nom.toLowerCase().includes(targetSearch.toLowerCase()) || 
        u.prenom.toLowerCase().includes(targetSearch.toLowerCase()) ||
        u.matricule.toLowerCase().includes(targetSearch.toLowerCase()) ||
        (u.service && u.service.toLowerCase().includes(targetSearch.toLowerCase())) ||
        (u.departement && u.departement.toLowerCase().includes(targetSearch.toLowerCase()))

      const cat = getRoleCategory(u.role)
      const matchesCat = perspective === 'BY_EVALUATEUR' || targetCategory === 'ALL' || cat === targetCategory
      const matchesSelection = showSelectedOnly ? targets.includes(u.id) : true

      return matchesSearch && matchesCat && matchesSelection
    })
    .sort((a, b) => {
      if (targetSort === 'role') {
        const order: Record<string, number> = { MANAGER: 1, UTILISATEUR: 2, EXTERNE: 3, ADMIN: 4 }
        return (order[a.role] || 99) - (order[b.role] || 99) || a.nom.localeCompare(b.nom)
      }
      return a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)
    })

  const handleToggleTarget = (userId: string) => {
    // Interdire formellement l'auto-évaluation
    if (!selectedUser || userId === selectedUser.id) return

    if (targets.includes(userId)) {
      setTargets(targets.filter(id => id !== userId))
    } else {
      setTargets([...targets, userId])
    }
  }

  const handleSelectAllFiltered = () => {
    if (!selectedUser) return
    const visibleIds = filteredRightUsers.map(u => u.id).filter(id => id !== selectedUser.id)
    const newTargets = Array.from(new Set([...targets, ...visibleIds]))
    setTargets(newTargets)
  }

  const handleDeselectAllFiltered = () => {
    const visibleIds = new Set(filteredRightUsers.map(u => u.id))
    setTargets(targets.filter(id => !visibleIds.has(id)))
  }

  const saveAffectations = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      // Nettoyer strictement toute auto-évaluation éventuelle
      const cleanTargets = targets.filter(tId => tId !== selectedUser.id)

      if (perspective === 'BY_EVALUE') {
        const r = await fetch(`/api/admin/campagnes/${campagneId}/affectations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'by_evalue',
            evalueId: selectedUser.id,
            evaluateurIds: cleanTargets
          })
        })
        if (!r.ok) throw new Error()
      } else {
        const r = await fetch(`/api/admin/campagnes/${campagneId}/affectations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'by_evaluateur',
            evaluateurId: selectedUser.id,
            evalueIds: cleanTargets
          })
        })
        if (!r.ok) throw new Error()
      }
      onUpdate()
      toast.success('Affectations enregistrées.')
    } catch {
      toast.error('Les affectations n’ont pas pu être enregistrées.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 text-slate-800">
      {/* ⇄ Barre de Permutation des Colonnes (Notants ↔ Notés) & Agrandissement x1.2 */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md transition-all ${
            perspective === 'BY_EVALUE' ? 'bg-navy-800 shadow-navy-200' : 'bg-slate-900 shadow-slate-300'
          }`}>
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Disposition des colonnes</span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Check className="w-3 h-3" /> Auto-évaluation interdite
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {perspective === 'BY_EVALUE' ? (
                <>Colonne gauche : <span className="text-navy-800">COLLABORATEURS NOTÉS</span> ➔ Colonne droite : <span className="text-slate-600">LEURS NOTANTS</span></>
              ) : (
                <>Colonne gauche : <span className="text-slate-900">ÉVALUATEURS NOTANTS</span> ➔ Colonne droite : <span className="text-navy-800">PERSONNES QU'ILS NOTENT</span></>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          {/* Sélecteur direct à deux modes */}
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs sm:text-sm font-bold">
            <button
              type="button"
              onClick={() => {
                if (perspective !== 'BY_EVALUE') {
                  setPerspective('BY_EVALUE')
                  setSelectedUser(null)
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                perspective === 'BY_EVALUE'
                  ? 'bg-navy-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>1. Notés à gauche</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (perspective !== 'BY_EVALUATEUR') {
                  setPerspective('BY_EVALUATEUR')
                  setSelectedUser(null)
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                perspective === 'BY_EVALUATEUR'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>2. Notants à gauche</span>
            </button>
          </div>

          {/* Bouton de Permutation Rapide Notants ↔ Notés */}
          <button
            type="button"
            onClick={() => {
              setPerspective(prev => prev === 'BY_EVALUE' ? 'BY_EVALUATEUR' : 'BY_EVALUE')
              setSelectedUser(null)
            }}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            title="Permuter les colonnes (Notants ↔ Notés)"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Permuter les colonnes</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Liste principale (Les Notés ou Les Notants) (xl:col-span-5) */}
        <div className="xl:col-span-5 space-y-3.5">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {perspective === 'BY_EVALUE' ? (
                  <Target className="w-5 h-5 text-navy-800" />
                ) : (
                  <UserCheck className="w-5 h-5 text-slate-700" />
                )}
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  {perspective === 'BY_EVALUE' ? 'LES NOTÉS (COLLABORATEURS)' : 'LES NOTANTS (ÉVALUATEURS)'}
                </h3>
              </div>
              <span className="text-xs sm:text-sm font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                {filteredLeftUsers.length} / {baseLeftUsers.length}
              </span>
            </div>

            {/* Filtres par Catégorie (affichés si mode Notant) */}
            {perspective === 'BY_EVALUATEUR' ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    categoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tous ({baseLeftUsers.length})
                </button>
                <button
                  onClick={() => setCategoryFilter('PAIR')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    categoryFilter === 'PAIR'
                      ? 'bg-navy-700 text-white shadow-sm'
                      : 'bg-navy-50 text-navy-800 hover:bg-navy-100'
                  }`}
                >
                  Pairs ({countPairs})
                </button>
                <button
                  onClick={() => setCategoryFilter('MANAGER')}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    categoryFilter === 'MANAGER'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                  }`}
                >
                  Managers ({countManagers})
                </button>
                {countExternes > 0 && (
                  <button
                    onClick={() => setCategoryFilter('EXTERNE')}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                      categoryFilter === 'EXTERNE'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Clients ({countExternes})
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs sm:text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl">
                  {baseLeftUsers.length} agents opérationnels évalués (hors managers & clients)
                </span>
              </div>
            )}

            {/* Recherche & Tri (Agrandis x1.2) */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={perspective === 'BY_EVALUE' ? "Rechercher par nom, matricule, service..." : "Rechercher un notant..."}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-navy-700 focus:bg-white outline-none text-xs sm:text-sm font-semibold"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as any)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 outline-none"
                title="Trier la liste"
              >
                <option value="name_asc">Nom A-Z</option>
                {perspective === 'BY_EVALUATEUR' && <option value="role">Par Catégorie</option>}
                <option value="count_desc">
                  {perspective === 'BY_EVALUE' ? 'Nb Notants ↓' : 'Nb Cibles ↓'}
                </option>
              </select>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden max-h-[700px] overflow-y-auto divide-y divide-slate-100">
            {filteredLeftUsers.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm font-medium">
                Aucun collaborateur ne correspond à votre filtre.
              </div>
            ) : (
              filteredLeftUsers.map(user => {
                const count = perspective === 'BY_EVALUE'
                  ? initialAffectations.filter(a => a.evalueId === user.id).length
                  : initialAffectations.filter(a => a.evaluateurId === user.id).length
                const catInfo = getCategoryLabel(user.role)
                const isSelected = selectedUser?.id === user.id

                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full text-left p-4 sm:p-4.5 flex items-center justify-between group transition-all ${
                      isSelected ? 'bg-navy-50 ring-1 ring-inset ring-navy-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm ${
                        user.role === 'MANAGER'
                          ? 'bg-teal-100 text-teal-800'
                          : user.role === 'EXTERNE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-navy-100 text-navy-900'
                      }`}>
                        {user.nom[0]}{user.prenom[0]}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-black text-sm sm:text-base truncate ${isSelected ? 'text-navy-950' : 'text-slate-900'}`}>
                          {user.nom} {user.prenom}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-mono text-slate-500 font-bold">#{user.matricule}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${catInfo.badge}`}>
                            {catInfo.label}
                          </span>
                          {user.service && (
                            <span className="text-xs text-slate-400 truncate max-w-[140px]">
                              • {user.service}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                      {count > 0 ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                          {count} {perspective === 'BY_EVALUE' ? `notant${count > 1 ? 's' : ''}` : `cible${count > 1 ? 's' : ''}`}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-400 text-xs font-bold">
                          0
                        </span>
                      )}
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-navy-800 translate-x-1' : 'text-slate-300'}`} />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: Panneau d'assignation (Ceux qui notent OU Les Notés) (xl:col-span-7) */}
        <div className="xl:col-span-7">
          {selectedUser ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
              {/* Header de droite (Agrandi x1.2) */}
              <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${getCategoryLabel(selectedUser.role).badge}`}>
                      {getCategoryLabel(selectedUser.role).label}
                    </span>
                    <h4 className="text-lg sm:text-xl font-black text-slate-900">
                      {perspective === 'BY_EVALUE' ? (
                        <>Ceux qui notent <span className="text-navy-800">{selectedUser.prenom} {selectedUser.nom}</span></>
                      ) : (
                        <>Les agents notés par <span className="text-navy-800">{selectedUser.prenom} {selectedUser.nom}</span></>
                      )}
                    </h4>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                    {perspective === 'BY_EVALUE'
                      ? `Sélectionnez les pairs, managers ou clients qui doivent noter ce collaborateur (${targets.length} notant${targets.length > 1 ? 's' : ''} assigné${targets.length > 1 ? 's' : ''}).`
                      : `Sélectionnez les collaborateurs opérationnels que cet évaluateur devra noter (${targets.length} sélectionné${targets.length > 1 ? 's' : ''}).`}
                  </p>
                </div>
                <button
                  onClick={saveAffectations}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 shadow-md disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Enregistrer ({targets.length})</span>
                </button>
              </div>
              
              {/* Filtres & Recherche de droite */}
              <div className="p-4 sm:p-5 bg-slate-50/30 border-b border-slate-100 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2.5">
                  {perspective === 'BY_EVALUE' ? (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="text-xs font-black text-slate-400 uppercase mr-1">
                        Notant :
                      </span>
                      <button
                        onClick={() => setTargetCategory('ALL')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                          targetCategory === 'ALL'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setTargetCategory('PAIR')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                          targetCategory === 'PAIR'
                            ? 'bg-navy-700 text-white shadow-sm'
                            : 'bg-navy-50 text-navy-800 hover:bg-navy-100'
                        }`}
                      >
                        Pairs / Collègues
                      </button>
                      <button
                        onClick={() => setTargetCategory('MANAGER')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                          targetCategory === 'MANAGER'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                        }`}
                      >
                        Managers
                      </button>
                      <button
                        onClick={() => setTargetCategory('EXTERNE')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                          targetCategory === 'EXTERNE'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        Clients Externes
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-slate-600 bg-slate-100 px-3.5 py-1.5 rounded-xl">
                        {baseRightUsers.length} collaborateurs évaluables disponibles
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSelectAllFiltered}
                      className="text-xs font-bold text-navy-800 hover:underline"
                    >
                      Tout cocher ({filteredRightUsers.length})
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      onClick={handleDeselectAllFiltered}
                      className="text-xs font-bold text-slate-500 hover:underline"
                    >
                      Tout décocher
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder={perspective === 'BY_EVALUE' ? "Rechercher qui doit le noter..." : "Rechercher un agent par nom, service..."}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-navy-700 outline-none text-xs sm:text-sm font-semibold"
                      value={targetSearch}
                      onChange={e => setTargetSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
                    <select
                      value={targetSort}
                      onChange={e => setTargetSort(e.target.value as any)}
                      className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 outline-none"
                      title="Trier la liste"
                    >
                      <option value="name_asc">Trier Nom A-Z</option>
                      {perspective === 'BY_EVALUE' && <option value="role">Trier par Catégorie</option>}
                    </select>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div 
                        onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${showSelectedOnly ? 'bg-navy-700 border-navy-700 text-white' : 'border-slate-300 bg-white'}`}
                      >
                        {showSelectedOnly && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                        Sélectionnés ({targets.length})
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Liste des personnes à cocher (Grille 2 colonnes avec ascenseur agrandie x1.2) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 max-h-[680px]">
                {filteredRightUsers.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm font-medium">
                    Aucun collaborateur trouvé avec les filtres sélectionnés.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredRightUsers.map(user => {
                      const isSelected = targets.includes(user.id)
                      const catInfo = getCategoryLabel(user.role)

                      return (
                        <button
                          key={user.id}
                          onClick={() => handleToggleTarget(user.id)}
                          className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-50/95 border-emerald-300 ring-2 ring-emerald-100 shadow-sm' 
                              : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 shadow-sm ${
                              user.role === 'MANAGER'
                                ? 'bg-teal-100 text-teal-800'
                                : user.role === 'EXTERNE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-navy-100 text-navy-900'
                            }`}>
                              {user.nom[0]}{user.prenom[0]}
                            </div>
                            <div className="text-left min-w-0">
                              <p className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-emerald-950 font-black' : 'text-slate-900'}`}>
                                {user.nom} {user.prenom}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-slate-500 font-bold">#{user.matricule}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${catInfo.badge}`}>
                                  {catInfo.label}
                                </span>
                                {user.service && (
                                  <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                                    • {user.service}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <div className={`w-6 h-6 rounded-xl flex items-center justify-center border transition-all ${
                              isSelected ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[380px] flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300 opacity-70 space-y-4">
              <Users2 className="w-16 h-16 text-slate-400" />
              <p className="text-lg sm:text-xl font-bold text-slate-800">
                {perspective === 'BY_EVALUE' ? "Sélectionnez un collaborateur noté" : "Sélectionnez un notant"}
              </p>
              <p className="text-slate-500 text-xs sm:text-sm text-center max-w-sm font-medium">
                {perspective === 'BY_EVALUE'
                  ? "Choisissez un agent dans la liste de gauche pour configurer les pairs, managers et clients qui doivent le noter."
                  : "Choisissez un évaluateur dans la liste de gauche pour lui assigner les personnes qu'il doit noter."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


function SuiviDashboard({ affectations, users }: { affectations: any[], users: User[] }) {
  const [suiviCategory, setSuiviCategory] = useState<'ALL' | 'PAIR' | 'MANAGER' | 'EXTERNE'>('ALL')
  const [suiviSearch, setSuiviSearch] = useState('')

  // Get all unique evaluateurs from affectations
  const evaluateurIds = [...new Set(affectations.map(a => a.evaluateurId))]
  
  // Calculate statuses
  const trackingData = evaluateurIds.map(evalId => {
    const user = users.find(u => u.id === evalId)
    const userAffectations = affectations.filter(a => a.evaluateurId === evalId)
    const isTerminee = userAffectations.some(a => a.statut === 'TERMINEE')
    const isBrouillon = userAffectations.some(a => a.statut === 'BROUILLON')
    
    let statut = 'EN_ATTENTE'
    if (isTerminee) statut = 'TERMINEE'
    else if (isBrouillon) statut = 'BROUILLON'

    return {
      user: user || { id: evalId, nom: 'Inconnu', prenom: '', matricule: '', role: 'UTILISATEUR' },
      statut,
      totalToEvaluate: userAffectations.length
    }
  })

  const getRoleCategory = (role: string) => {
    if (role === 'MANAGER') return 'MANAGER'
    if (role === 'EXTERNE') return 'EXTERNE'
    return 'PAIR'
  }

  const filteredTracking = trackingData.filter(d => {
    const matchesSearch =
      d.user.nom.toLowerCase().includes(suiviSearch.toLowerCase()) ||
      d.user.prenom.toLowerCase().includes(suiviSearch.toLowerCase()) ||
      d.user.matricule.toLowerCase().includes(suiviSearch.toLowerCase())

    const cat = getRoleCategory(d.user.role)
    const matchesCat = suiviCategory === 'ALL' || cat === suiviCategory

    return matchesSearch && matchesCat
  })

  const countTerminee = filteredTracking.filter(d => d.statut === 'TERMINEE').length
  const countBrouillon = filteredTracking.filter(d => d.statut === 'BROUILLON').length
  const countAttente = filteredTracking.filter(d => d.statut === 'EN_ATTENTE').length
  const total = filteredTracking.length

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-500 font-bold text-sm">Évaluateurs Filtrés</span>
          <span className="text-3xl font-black text-slate-900 mt-2">{total}</span>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" /> Terminées
          </div>
          <span className="text-3xl font-black text-emerald-700 mt-2">{countTerminee}</span>
        </div>
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
            <Activity className="w-5 h-5" /> En cours (Brouillon)
          </div>
          <span className="text-3xl font-black text-amber-700 mt-2">{countBrouillon}</span>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
            <Clock className="w-5 h-5" /> Non commencées
          </div>
          <span className="text-3xl font-black text-slate-700 mt-2">{countAttente}</span>
        </div>
      </div>

      {/* Tableau détaillé avec filtres */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Détail par évaluateur</h3>
            <p className="text-xs text-slate-500 font-medium">Suivi de la participation par profil</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {/* Category pills */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setSuiviCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  suiviCategory === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setSuiviCategory('PAIR')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  suiviCategory === 'PAIR' ? 'bg-navy-700 text-white' : 'text-navy-800 hover:bg-navy-50'
                }`}
              >
                Pairs
              </button>
              <button
                onClick={() => setSuiviCategory('MANAGER')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  suiviCategory === 'MANAGER' ? 'bg-teal-600 text-white' : 'text-teal-700 hover:bg-teal-50'
                }`}
              >
                Managers
              </button>
              <button
                onClick={() => setSuiviCategory('EXTERNE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  suiviCategory === 'EXTERNE' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                Clients
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrer..."
                value={suiviSearch}
                onChange={e => setSuiviSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
              />
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredTracking.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-medium">
              Aucun évaluateur ne correspond aux filtres.
            </div>
          )}
          {filteredTracking.map((data, idx) => (
            <div key={idx} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                  data.user.role === 'MANAGER'
                    ? 'bg-teal-100 text-teal-800'
                    : data.user.role === 'EXTERNE'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-navy-100 text-navy-900'
                }`}>
                  {data.user.nom?.[0] || '?'}{data.user.prenom?.[0] || '?'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900">{data.user.prenom} {data.user.nom}</p>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                      data.user.role === 'MANAGER'
                        ? 'bg-teal-100 text-teal-800'
                        : data.user.role === 'EXTERNE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-navy-100 text-navy-900'
                    }`}>
                      {data.user.role === 'MANAGER' ? 'Manager' : data.user.role === 'EXTERNE' ? 'Client Ext.' : 'Pair'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Matricule: {data.user.matricule} • Doit évaluer {data.totalToEvaluate} agents</p>
                </div>
              </div>
              <div>
                {data.statut === 'TERMINEE' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">
                    <CheckCircle2 className="w-4 h-4" /> Finalisé
                  </span>
                )}
                {data.statut === 'BROUILLON' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-black">
                    <Activity className="w-4 h-4" /> En cours
                  </span>
                )}
                {data.statut === 'EN_ATTENTE' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-black">
                    <Clock className="w-4 h-4" /> Non commencé
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ClassementCampagneView({ 
  campagneId, 
  formData, 
  onRecalculate 
}: { 
  campagneId: string
  formData: any
  onRecalculate: () => Promise<void> 
}) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [subTab, setSubTab] = useState<'palmares' | 'global' | 'direction' | 'departement' | 'service'>('palmares')
  const [search, setSearch] = useState('')
  const [filterDirection, setFilterDirection] = useState('ALL')
  const [filterDepartement, setFilterDepartement] = useState('ALL')
  const [filterService, setFilterService] = useState('ALL')
  const [anonymized, setAnonymized] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/classement?campagneId=${encodeURIComponent(campagneId)}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' }
      })
      const resData = await res.json()
      if (resData && !resData.error) {
        setData(resData)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [campagneId])

  const handleTriggerRecalculate = async () => {
    setCalculating(true)
    try {
      const res = await fetch('/api/admin/classement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ campagneId }),
      })
      const resData = await res.json()
      if (resData && !resData.error) {
        setData(resData)
      } else {
        await loadData()
      }
      await onRecalculate()
    } catch (e) {
      console.error(e)
      await loadData()
    } finally {
      setCalculating(false)
    }
  }

  const exportToExcel = async () => {
    if (!data || !data.tousLesScores || data.tousLesScores.length === 0) return
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // 1. Feuille Palmarès
    const palmaresData: any[] = []
    if (data.laureats?.majorGlobal) {
      const mg = data.laureats.majorGlobal
      palmaresData.push({
        Distinction: 'Premier toutes entités',
        Entité: mg.direction,
        Matricule: mg.matricule,
        Nom: mg.nom,
        Prénom: mg.prenom,
        Service: mg.service,
        Département: mg.departement,
        'Score Total (%)': mg.scoreTotal,
        Dotation: formData.prixDirection || formData.prixGlobal || '—',
      })
    }
    data.laureats?.majorsDepartement?.forEach((md: any) => {
      palmaresData.push({
        Distinction: 'Premier de département',
        Entité: `${md.departementNom} (${md.directionNom})`,
        Matricule: md.major.matricule,
        Nom: md.major.nom,
        Prénom: md.major.prenom,
        Service: md.major.service,
        Département: md.departementNom,
        'Score Total (%)': md.major.scoreTotal,
        Dotation: formData.prixDepartement || '—',
      })
    })
    data.laureats?.majorsService?.forEach((ms: any) => {
      palmaresData.push({
        Distinction: 'Premier de service',
        Entité: `${ms.serviceNom} (${ms.departementNom})`,
        Matricule: ms.major.matricule,
        Nom: ms.major.nom,
        Prénom: ms.major.prenom,
        Service: ms.serviceNom,
        Département: ms.departementNom,
        'Score Total (%)': ms.major.scoreTotal,
        Dotation: formData.prixService || "Tableau d'honneur",
      })
    })
    const wsPalmares = XLSX.utils.json_to_sheet(palmaresData)
    XLSX.utils.book_append_sheet(wb, wsPalmares, 'Palmarès & Lauréats')

    // 2. Feuille Tous les scores
    const allData = data.tousLesScores.map((s: any, idx: number) => {
      const hasCli = s.hasClient ?? (s.scoreClient > 0)
      const partManager = s.partManager
      const partCollegues = s.partCollegues
      const maxCollegues = s.maxCollegues
      const partClients = s.partClient
      const maxClients = s.maxClient
      const partNonManager = Math.round((partCollegues + partClients) * 10) / 10

      return {
        Rang: s.rangGlobal || idx + 1,
        Matricule: s.matricule,
        Nom: s.nom,
        Prénom: s.prenom,
        Direction: s.direction,
        Département: s.departement,
        Service: s.service,
        'Part Collègues (pts)': `${partCollegues}/${maxCollegues}`,
        'Part Clients QR (pts)': hasCli ? `${partClients}/${maxClients}` : 'Non concerné',
        'Total collègues & clients (pts)': `${partNonManager}/${formData.poidsCollegues}`,
        'Part manager (pts)': `${partManager}/${s.maxManager}`,
        'Score Total (/100)': s.scoreTotal,
        Appréciation: getAppreciationInfo(s.scoreTotal).appreciation,
      }
    })
    const wsAll = XLSX.utils.json_to_sheet(allData)
    XLSX.utils.book_append_sheet(wb, wsAll, 'Classement Général')

    XLSX.writeFile(wb, `Classement_${formData.libelle ? formData.libelle.replace(/\s+/g, '_') : 'Campagne'}.xlsx`)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-16 border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-100 border-t-gold-500 animate-spin"></div>
        <p className="text-slate-600 font-bold text-sm">Chargement des résultats et palmarès de la campagne...</p>
      </div>
    )
  }

  const allScores = data?.tousLesScores || []
  const majorGlobal = data?.laureats?.majorGlobal
  const majorsDepartement = data?.laureats?.majorsDepartement || []
  const majorsService = data?.laureats?.majorsService || []
  const groupesDirection = data?.groupesDirection || []
  const groupesDepartement = data?.groupesDepartement || []
  const groupesService = data?.groupesService || []

  const directions = Array.from(new Set(allScores.map((s: any) => s.direction).filter(Boolean))) as string[]
  const departements = Array.from(new Set(allScores.map((s: any) => s.departement).filter(Boolean))) as string[]
  const services = Array.from(new Set(allScores.map((s: any) => s.service).filter(Boolean))) as string[]

  const filteredScores = allScores.filter((s: any) => {
    const matchesSearch = 
      s.nom?.toLowerCase().includes(search.toLowerCase()) ||
      s.prenom?.toLowerCase().includes(search.toLowerCase()) ||
      s.matricule?.toLowerCase().includes(search.toLowerCase()) ||
      s.service?.toLowerCase().includes(search.toLowerCase())
    const matchesDir = filterDirection === 'ALL' || s.direction === filterDirection
    const matchesDept = filterDepartement === 'ALL' || s.departement === filterDepartement
    const matchesServ = filterService === 'ALL' || s.service === filterService
    return matchesSearch && matchesDir && matchesDept && matchesServ
  })

  return (
    <div className="space-y-6">
      {/* Header Banner Classement de la Session */}
      <div className="bg-navy-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-gold-500 font-black text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-gold-500" /> Session DSM TAMIS
              </span>
              {formData.statut === 'OUVERTE' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Notation active
                </span>
              )}
              {formData.statut === 'CLOTUREE' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  <Lock className="w-3 h-3" />
                  Session clôturée
                </span>
              )}
              {formData.statut === 'CALCULEE' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-navy-600/20 text-navy-300 border border-navy-400/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Scores définitifs
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">{formData.libelle || 'Classement de la Campagne'}</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Pondération appliquée : Collègues {formData.poidsCollegues}% • Manager {formData.poidsManager}% • Total agents évalués : {allScores.length}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleTriggerRecalculate}
              disabled={calculating}
              className="flex items-center gap-2 px-4 py-2.5 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
              <span>{calculating ? 'Calcul en cours...' : 'Recalculer'}</span>
            </button>

            <button
              type="button"
              onClick={exportToExcel}
              disabled={allScores.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter Excel</span>
            </button>

            <Link
              href={`/admin/classement?campagneId=${campagneId}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Plein écran</span>
            </Link>
          </div>
        </div>
      </div>

      {allScores.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Aucun résultat pour le moment</h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Les scores de cette campagne n'ont pas encore été calculés ou aucune note n'a été soumise.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTriggerRecalculate}
            disabled={calculating}
            className="px-6 py-3 bg-navy-900 text-gold-500 border border-gold-500/40 rounded-xl text-xs font-black transition-all hover:bg-navy-950 shadow-md"
          >
            {calculating ? 'Calcul en cours...' : 'Calculer les scores maintenant'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sous-onglets de navigation du classement */}
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1">
            <div className="inline-flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
              <button
                onClick={() => setSubTab('palmares')}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                  subTab === 'palmares'
                    ? 'bg-navy-900 text-gold-500 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" /> Palmarès Officiel
              </button>
              <button
                onClick={() => setSubTab('global')}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                  subTab === 'global'
                    ? 'bg-navy-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" /> Classement Général ({allScores.length})
              </button>
              <button
                onClick={() => setSubTab('direction')}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                  subTab === 'direction'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Par Direction
              </button>
              <button
                onClick={() => setSubTab('departement')}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                  subTab === 'departement'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" /> Par Département
              </button>
              <button
                onClick={() => setSubTab('service')}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                  subTab === 'service'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users2 className="w-3.5 h-3.5" /> Par Service
              </button>
            </div>

            {subTab === 'global' && (
              <button
                onClick={() => setAnonymized(!anonymized)}
                className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                {anonymized ? <Eye className="w-4 h-4 text-navy-800" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                <span>{anonymized ? 'Noms visibles' : 'Anonymiser'}</span>
              </button>
            )}
          </div>

          {/* TAB 1: PALMARÈS & LAURÉATS */}
          {subTab === 'palmares' && (
            <div className="space-y-6">
              {/* Super Lauréat Direction DSM Card */}
              {majorGlobal ? (
                <div className="bg-gold-50 ring-1 ring-gold-300 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-20 h-20 rounded-2xl bg-gold-500 text-navy-900 font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white">
                        <Crown className="w-10 h-10 text-white drop-shadow" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-navy-900 text-gold-500 px-3 py-0.5 rounded-full border border-gold-500/30 flex items-center gap-1">
                            <Trophy className="w-3 h-3" /> Super Lauréat Direction DSM
                          </span>
                          <span className="text-xs font-bold text-amber-900">Palier 1</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900">
                          {anonymized ? `Agent ${majorGlobal.matricule}` : `${majorGlobal.prenom} ${majorGlobal.nom}`}
                        </h3>
                        <p className="text-xs text-slate-600 font-medium">
                          Matricule: <span className="font-bold text-slate-800">{majorGlobal.matricule}</span> • {majorGlobal.service} ({majorGlobal.departement}) • {majorGlobal.direction}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/80 p-4 rounded-2xl border border-amber-200">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Score TAMIS Final</span>
                        <span className="text-3xl font-black text-emerald-600">{majorGlobal.scoreTotal}%</span>
                      </div>
                      <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>
                      <div className="text-left">
                        <span className="text-[10px] font-black uppercase tracking-wider text-navy-900 block">Dotation Officielle</span>
                        <span className="text-xs font-black text-amber-900">
                          {formData.prixDirection || formData.prixGlobal || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Grid Majors Département */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Medal className="w-5 h-5 text-teal-600" />
                    <h4 className="font-black text-slate-900 text-base">Meilleurs Agents par Département</h4>
                    <span className="text-[10px] font-black bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full">
                      Palier 2 • {formData.prixDepartement || '—'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{majorsDepartement.length} lauréats</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {majorsDepartement.map((md: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-2xl p-5 border border-teal-100 shadow-sm hover:shadow-md transition-all space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg uppercase">
                          {md.departementNom}
                        </span>
                        <span className="text-sm font-black text-emerald-600">{md.major.scoreTotal}%</span>
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">
                          {anonymized ? `Agent ${md.major.matricule}` : `${md.major.prenom} ${md.major.nom}`}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {md.major.service} • Mat: {md.major.matricule}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>Sur {md.totalAgents} agents</span>
                        <span className="text-teal-700">{formData.prixDepartement || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid Majors Service */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-black text-slate-900 text-base">Meilleurs Agents par Service / Cellule</h4>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      Palier 3 • {formData.prixService || '—'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{majorsService.length} lauréats</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {majorsService.map((ms: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm hover:shadow-md transition-all space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase truncate max-w-[180px]">
                          {ms.serviceNom}
                        </span>
                        <span className="text-sm font-black text-emerald-600">{ms.major.scoreTotal}%</span>
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">
                          {anonymized ? `Agent ${ms.major.matricule}` : `${ms.major.prenom} ${ms.major.nom}`}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {ms.departementNom} • Mat: {ms.major.matricule}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>Sur {ms.totalAgents} agents</span>
                        <span className="text-emerald-700 font-bold truncate max-w-[120px]" title={formData.prixService || "Tableau d'honneur"}>{formData.prixService || "Tableau d'honneur"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLASSEMENT GÉNÉRAL INTÉGRAL */}
          {subTab === 'global' && (
            <div className="space-y-4">
              {/* Filtres de recherche */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, matricule ou service..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-700"
                  />
                </div>

                {departements.length > 0 && (
                  <select
                    value={filterDepartement}
                    onChange={e => setFilterDepartement(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">Tous les départements</option>
                    {departements.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}

                {services.length > 0 && (
                  <select
                    value={filterService}
                    onChange={e => setFilterService(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">Tous les services</option>
                    {services.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>

              {/* Tableau des scores */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-black text-[10px]">
                      <tr>
                        <th className="py-3.5 px-4 text-center w-16">Rang</th>
                        <th className="py-3.5 px-4">Collaborateur</th>
                        <th className="py-3.5 px-4">Entité / Service</th>
                        <th className="py-3.5 px-3 text-center">Collègues & Pairs</th>
                        <th className="py-3.5 px-3 text-center">Manager (55 pts)</th>
                        <th className="py-3.5 px-3 text-center">Client QR</th>
                        <th className="py-3.5 px-4 text-center font-black text-slate-800">Score Total (/100)</th>
                        <th className="py-3.5 px-4 text-center">Mention</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredScores.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                            Aucun collaborateur ne correspond aux filtres de recherche.
                          </td>
                        </tr>
                      ) : (
                        filteredScores.map((score: any, idx: number) => {
                          const appInfo = getAppreciationInfo(score.scoreTotal)
                          const rang = score.rangGlobal || idx + 1
                          const hasColl = score.hasCollegues ?? (score.scoreCollegues > 0)
                          const hasCli = score.hasClient ?? (score.scoreClient > 0)
                          const partManager = score.partManager
                          const partCollegues = score.partCollegues
                          const maxCollegues = score.maxCollegues
                          const partClients = score.partClient
                          const maxClients = score.maxClient

                          return (
                            <tr key={score.utilisateurId || idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4 text-center font-black">
                                {rang === 1 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black text-xs border border-amber-300">
                                    1
                                  </span>
                                ) : rang === 2 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-800 font-black text-xs">
                                    2
                                  </span>
                                ) : rang === 3 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-900 font-black text-xs">
                                    3
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-bold">#{rang}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="font-bold text-slate-900">
                                  {anonymized ? `Agent ${score.matricule}` : `${score.prenom} ${score.nom}`}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">Matricule: {score.matricule}</p>
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="font-bold text-slate-700">{score.service}</p>
                                <p className="text-[10px] text-slate-400">{score.departement}</p>
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                {hasColl ? (
                                  <div>
                                    <span className="font-bold text-slate-800">{partCollegues}</span>
                                    <span className="text-[10px] text-slate-400">/{maxCollegues} pts</span>
                                    <span className="text-[10px] text-navy-700 block font-normal">({score.scoreCollegues.toFixed(0)}%)</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">Non noté</span>
                                )}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                {score.hasManager || score.scoreManager > 0 ? (
                                  <div>
                                    <span className="font-bold text-slate-800">{partManager}</span>
                                    <span className="text-[10px] text-slate-400">/55 pts</span>
                                    <span className="text-[10px] text-navy-700 block font-normal">({score.scoreManager.toFixed(0)}%)</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">Non noté</span>
                                )}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                {hasCli ? (
                                  <div>
                                    <span className="font-bold text-slate-800">{partClients}</span>
                                    <span className="text-[10px] text-slate-400">/{maxClients} pts</span>
                                    <span className="text-[10px] text-amber-600 block font-normal">({score.scoreClient.toFixed(0)}%)</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs font-medium">Non concerné</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="text-sm font-black text-slate-900">{score.scoreTotal.toFixed(1)} / 100</span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${appInfo.colorBadge}`}>
                                  {appInfo.appreciation}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PAR DIRECTION */}
          {subTab === 'direction' && (
            <div className="space-y-4">
              {groupesDirection.map((g: any, idx: number) => (
                <div key={idx} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-5 h-5 text-amber-600" />
                      <h4 className="font-black text-slate-900 text-base">{g.directionNom}</h4>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{g.scores.length} collaborateurs</span>
                  </div>
                  {g.major && (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Crown className="w-6 h-6 text-amber-600" />
                        <div>
                          <span className="text-[10px] font-black text-amber-800 uppercase">Major Direction</span>
                          <p className="font-black text-slate-900 text-sm">{g.major.prenom} {g.major.nom} ({g.major.service})</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-emerald-600">{g.major.scoreTotal}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: PAR DÉPARTEMENT */}
          {subTab === 'departement' && (
            <div className="space-y-4">
              {groupesDepartement.map((g: any, idx: number) => (
                <div key={idx} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <FolderGit2 className="w-5 h-5 text-teal-600" />
                      <div>
                        <h4 className="font-black text-slate-900 text-base">{g.departementNom}</h4>
                        <p className="text-[10px] text-slate-400 font-bold">{g.directionNom}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{g.scores.length} collaborateurs</span>
                  </div>
                  {g.major && (
                    <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Medal className="w-6 h-6 text-teal-600" />
                        <div>
                          <span className="text-[10px] font-black text-teal-800 uppercase">Major Département</span>
                          <p className="font-black text-slate-900 text-sm">{g.major.prenom} {g.major.nom} ({g.major.service})</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-emerald-600">{g.major.scoreTotal}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: PAR SERVICE */}
          {subTab === 'service' && (
            <div className="space-y-4">
              {groupesService.map((g: any, idx: number) => (
                <div key={idx} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Users2 className="w-5 h-5 text-emerald-600" />
                      <div>
                        <h4 className="font-black text-slate-900 text-base">{g.serviceNom}</h4>
                        <p className="text-[10px] text-slate-400 font-bold">{g.departementNom}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{g.scores.length} collaborateurs</span>
                  </div>
                  {g.major && (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Gift className="w-6 h-6 text-emerald-600" />
                        <div>
                          <span className="text-[10px] font-black text-emerald-800 uppercase">Major Service</span>
                          <p className="font-black text-slate-900 text-sm">{g.major.prenom} {g.major.nom}</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-emerald-600">{g.major.scoreTotal}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
