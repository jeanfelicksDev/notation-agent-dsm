'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, AlertCircle, Calendar, Plus, Pencil, X, Check, ClipboardList, Settings2, Users2, ChevronRight, LayoutDashboard, Search, Activity, Clock, CheckCircle2, Lock, BarChart3 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import AdminHeader from '@/components/AdminHeader'

interface Critere {
  id: string
  libelle: string
  description: string | null
  noteMaximale: number
  typeEvaluateur: string
}

interface User {
  id: string
  matricule: string
  nom: string
  prenom: string
  role: string
}

export default function CampagneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'config' | 'criteres' | 'affectations' | 'suivi'>('config')

  const [formData, setFormData] = useState({
    libelle: '',
    dateDebut: '',
    dateFin: '',
    poidsCollegues: 45,
    poidsManager: 55,
    statut: 'OUVERTE'
  })

  const [criteres, setCriteres] = useState<Critere[]>([])
  const [showCritereForm, setShowCritereForm] = useState(false)
  const [editingCritere, setEditingCritere] = useState<string | null>(null)
  const [critereForm, setCritereForm] = useState({
    libelle: '',
    description: '',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE'
  })

  const [allUsers, setAllUsers] = useState<User[]>([])
  const [affectations, setAffectations] = useState<any[]>([])
  const [closing, setClosing] = useState(false)
  const [calculating, setCalculating] = useState(false)

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
    fetch(`/api/admin/campagnes/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setFormData({
            libelle: data.libelle,
            dateDebut: new Date(data.dateDebut).toISOString().split('T')[0],
            dateFin: new Date(data.dateFin).toISOString().split('T')[0],
            poidsCollegues: data.poidsCollegues,
            poidsManager: data.poidsManager,
            statut: data.statut
          })
        }
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
    loadCriteres()
    loadUsers()
    loadAffectations()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/campagnes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        router.refresh()
        // Success feedback could be added here
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
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return

    try {
      const res = await fetch(`/api/admin/campagnes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/campagnes')
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (err) {
      alert('Erreur de connexion')
    }
  }

  const resetCritereForm = () => {
    setCritereForm({ libelle: '', description: '', noteMaximale: 5, typeEvaluateur: 'COLLEGUE' })
    setShowCritereForm(false)
    setEditingCritere(null)
  }

  const handleCritereSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!critereForm.libelle) return

    try {
      const method = editingCritere ? 'PATCH' : 'POST'
      const url = editingCritere 
        ? `/api/admin/campagnes/${id}/criteres/${editingCritere}`
        : `/api/admin/campagnes/${id}/criteres`

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(critereForm)
      })
      resetCritereForm()
      loadCriteres()
    } catch (err) {
      alert('Erreur lors de l\'enregistrement du critère')
    }
  }

  const handleDeleteCritere = async (critereId: string) => {
    if (!confirm('Supprimer ce critère ?')) return
    try {
      await fetch(`/api/admin/campagnes/${id}/criteres/${critereId}`, { method: 'DELETE' })
      loadCriteres()
    } catch (err) {
      alert('Erreur lors de la suppression')
    }
  }

  const startEditCritere = (critere: Critere) => {
    setCritereForm({
      libelle: critere.libelle,
      description: critere.description || '',
      noteMaximale: critere.noteMaximale,
      typeEvaluateur: critere.typeEvaluateur
    })
    setEditingCritere(critere.id)
    setShowCritereForm(true)
  }

  const handleCloture = async () => {
    if (!confirm('Clôturer cette campagne ? Les évaluateurs ne pourront plus soumettre de notes.')) return
    setClosing(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/campagnes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'CLOTUREE' }),
      })
      if (res.ok) {
        setFormData(prev => ({ ...prev, statut: 'CLOTUREE' }))
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur lors de la clôture')
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setClosing(false)
    }
  }

  const handleCalculScores = async () => {
    if (!confirm('Calculer les scores définitifs ? Cette action est irréversible.')) return
    setCalculating(true)
    setError('')
    try {
      const res = await fetch('/api/admin/classement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campagneId: id }),
      })
      const data = await res.json()
      if (res.ok) {
        setFormData(prev => ({ ...prev, statut: 'CALCULEE' }))
        alert('Scores calculés avec succès !')
      } else {
        setError(data.error || 'Erreur lors du calcul')
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setCalculating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin"></div>
      </div>
    )
  }

  const typeLabels: Record<string, string> = {
    COLLEGUE: 'Collègues',
    MANAGER: 'Managers',
    TOUS: 'Tous'
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title={formData.libelle || 'Détails Campagne'} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header / Actions */}
            <div className="flex items-center justify-between animate-fade-in">
              <Link href="/admin/campagnes" className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" /> Retour
              </Link>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-all font-bold"
              >
                <Trash2 className="w-5 h-5" /> Supprimer
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
              <button 
                onClick={() => setActiveTab('config')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'config' ? 'bg-brand-500 text-white shadow-lg shadow-brand-100' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Settings2 className="w-5 h-5" /> Configuration
              </button>
              <button 
                onClick={() => setActiveTab('criteres')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'criteres' ? 'bg-brand-500 text-white shadow-lg shadow-brand-100' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <ClipboardList className="w-5 h-5" /> Critères
              </button>
              <button 
                onClick={() => setActiveTab('affectations')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'affectations' ? 'bg-brand-500 text-white shadow-lg shadow-brand-100' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Users2 className="w-5 h-5" /> Affectations
              </button>
              <button 
                onClick={() => setActiveTab('suivi')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'suivi' ? 'bg-brand-500 text-white shadow-lg shadow-brand-100' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Activity className="w-5 h-5" /> Suivi
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 animate-fade-in">
                <AlertCircle className="w-5 h-5" />
                <p className="font-bold">{error}</p>
              </div>
            )}

            {/* Tab Content */}
            <div className="animate-fade-in" key={activeTab}>
              {activeTab === 'config' && (
                <div className="glass rounded-3xl p-8 border border-slate-200/50 shadow-sm space-y-8">
                  <div className="space-y-1">
                    <h3 className="text-xl font-display font-bold text-slate-900">Paramètres Généraux</h3>
                    <p className="text-slate-500 text-sm font-medium">Définissez les bases de votre campagne d'évaluation.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Libellé de la campagne</label>
                      <input
                        type="text"
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white transition-all outline-none font-bold text-slate-800"
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
                          className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white transition-all outline-none font-bold text-slate-800"
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
                          className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white transition-all outline-none font-bold text-slate-800"
                          value={formData.dateFin}
                          onChange={e => setFormData({ ...formData, dateFin: e.target.value })}
                        />
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Statut Actuel</label>
                      <select
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 focus:bg-white transition-all outline-none font-bold text-slate-800 appearance-none"
                        value={formData.statut}
                        onChange={e => setFormData({ ...formData, statut: e.target.value })}
                      >
                        <option value="OUVERTE">Ouverte</option>
                        <option value="CLOTUREE">Clôturée</option>
                        <option value="CALCULEE">Calculée</option>
                      </select>
                    </div>

                    <div className="space-y-4 md:col-span-2 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Répartition des poids</label>
                        <span className="text-sm font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">Total 100%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-600 block">Collègues (%)</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-black text-brand-600 text-xl"
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
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-black text-amber-600 text-xl"
                            value={formData.poidsManager}
                            onChange={e => {
                              const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                              setFormData({ ...formData, poidsManager: val, poidsCollegues: 100 - val })
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 pt-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {formData.statut === 'OUVERTE' && (
                          <button
                            type="button"
                            onClick={handleCloture}
                            disabled={closing}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-2xl font-black transition-all active:scale-[0.98] shadow-xl disabled:opacity-50 flex items-center gap-3"
                          >
                            {closing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                            Clôturer la campagne
                          </button>
                        )}
                        {formData.statut === 'CLOTUREE' && (
                          <button
                            type="button"
                            onClick={handleCalculScores}
                            disabled={calculating}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black transition-all active:scale-[0.98] shadow-xl disabled:opacity-50 flex items-center gap-3"
                          >
                            {calculating ? <Loader2 className="w-5 h-5 animate-spin" /> : <BarChart3 className="w-5 h-5" />}
                            Calculer les scores
                          </button>
                        )}
                        {formData.statut === 'CALCULEE' && (
                          <span className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-black border border-emerald-200">
                            <CheckCircle2 className="w-5 h-5" /> Scores calculés
                          </span>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-xl disabled:opacity-50 flex items-center gap-3"
                      >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Enregistrer les modifications
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'criteres' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-display font-bold text-slate-900">Critères d'évaluation</h3>
                      <p className="text-slate-500 font-medium">Définissez sur quels points les agents seront notés.</p>
                    </div>
                    {!showCritereForm && (
                      <button
                        onClick={() => { resetCritereForm(); setShowCritereForm(true) }}
                        className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-brand-100 transition-all active:scale-95"
                      >
                        <Plus className="w-5 h-5" /> Ajouter un critère
                      </button>
                    )}
                  </div>

                  {showCritereForm && (
                    <div className="glass rounded-3xl p-8 border border-brand-200 shadow-lg animate-fade-in relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500"></div>
                      <form onSubmit={handleCritereSubmit} className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-lg font-bold text-slate-900">{editingCritere ? 'Modifier le critère' : 'Nouveau critère'}</h4>
                          <button type="button" onClick={resetCritereForm} className="p-2 hover:bg-slate-100 rounded-full">
                            <X className="w-5 h-5 text-slate-400" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Libellé du critère</label>
                            <input
                              type="text"
                              required
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 outline-none font-bold"
                              value={critereForm.libelle}
                              onChange={e => setCritereForm({ ...critereForm, libelle: e.target.value })}
                              placeholder="Ex: Ponctualité et assiduité"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Note maximale</label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 outline-none font-bold"
                              value={critereForm.noteMaximale}
                              onChange={e => setCritereForm({ ...critereForm, noteMaximale: parseInt(e.target.value) || 5 })}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Évaluateur autorisé</label>
                            <select
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 outline-none font-bold"
                              value={critereForm.typeEvaluateur}
                              onChange={e => setCritereForm({ ...critereForm, typeEvaluateur: e.target.value })}
                            >
                              <option value="COLLEGUE">Uniquement Collègues</option>
                              <option value="MANAGER">Uniquement Manager</option>
                              <option value="TOUS">Tous les évaluateurs</option>
                            </select>
                          </div>
                          
                          <div className="md:col-span-2 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description détaillée</label>
                            <textarea
                              rows={3}
                              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 outline-none font-medium text-slate-600"
                              value={critereForm.description}
                              onChange={e => setCritereForm({ ...critereForm, description: e.target.value })}
                              placeholder="Décrivez ce que ce critère évalue précisément..."
                            />
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

                  <div className="grid grid-cols-1 gap-4">
                    {criteres.map((critere, index) => (
                      <div 
                        key={critere.id} 
                        className="glass card-hover rounded-2xl border border-slate-200/50 p-6 flex items-center justify-between group animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h4 className="text-lg font-bold text-slate-900">{critere.libelle}</h4>
                            <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-600 text-xs font-black border border-brand-100">
                              Note: 0 à {critere.noteMaximale}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-black">
                              {typeLabels[critere.typeEvaluateur] || critere.typeEvaluateur}
                            </span>
                          </div>
                          {critere.description && (
                            <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">{critere.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditCritere(critere)}
                            className="p-3 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCritere(critere.id)}
                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {criteres.length === 0 && !showCritereForm && (
                      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 animate-fade-in">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                          <ClipboardList className="w-16 h-16" />
                          <div className="space-y-1">
                            <p className="text-xl font-display font-bold">Aucun critère</p>
                            <p className="text-slate-500 font-medium">Démarrez en ajoutant votre premier critère de notation.</p>
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
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function AffectationsManager({ campagneId, users, initialAffectations, onUpdate }: { campagneId: string, users: User[], initialAffectations: any[], onUpdate: () => void }) {
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [targetSearch, setTargetSearch] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  // Get users that the selected user MUST evaluate
  const currentTargets = initialAffectations
    .filter(a => a.evaluateurId === selectedUser?.id)
    .map(a => a.evalueId)

  useEffect(() => {
    if (selectedUser) {
      setTargets(currentTargets)
    }
  }, [selectedUser, initialAffectations])

  const filteredUsers = users.filter(u => 
    u.nom.toLowerCase().includes(search.toLowerCase()) || 
    u.prenom.toLowerCase().includes(search.toLowerCase()) ||
    u.matricule.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggleTarget = (userId: string) => {
    if (targets.includes(userId)) {
      setTargets(targets.filter(id => id !== userId))
    } else {
      setTargets([...targets, userId])
    }
  }

  const saveAffectations = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      await fetch(`/api/admin/campagnes/${campagneId}/affectations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluateurId: selectedUser.id,
          evalueIds: targets
        })
      })
      onUpdate()
      alert('Affectations mises à jour avec succès')
    } catch (err) {
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 animate-fade-in">
      {/* Left: User List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un participant..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 outline-none font-bold"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden max-h-[600px] overflow-y-auto">
          {filteredUsers.map(user => {
            const count = initialAffectations.filter(a => a.evaluateurId === user.id).length
            return (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full text-left p-4 border-b border-slate-100 flex items-center justify-between group transition-all ${selectedUser?.id === user.id ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${selectedUser?.id === user.id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {user.nom[0]}{user.prenom[0]}
                  </div>
                  <div>
                    <p className={`font-bold ${selectedUser?.id === user.id ? 'text-brand-900' : 'text-slate-800'}`}>{user.nom} {user.prenom}</p>
                    <p className="text-xs text-slate-500 font-medium">{user.matricule}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                      {count} cibles
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedUser?.id === user.id ? 'text-brand-500 translate-x-1' : 'text-slate-300'}`} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: Targets Selection */}
      <div className="lg:col-span-3">
        {selectedUser ? (
          <div className="glass rounded-3xl border border-slate-200/50 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
              <div>
                <h4 className="text-xl font-display font-black text-slate-900">
                  Qui doit noter <span className="text-brand-500">{selectedUser.prenom}</span> ?
                </h4>
                <p className="text-sm text-slate-500 font-medium">Sélectionnez les personnes qu'il devra évaluer.</p>
              </div>
              <button
                onClick={saveAffectations}
                disabled={saving}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sauvegarder
              </button>
            </div>
            
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher une cible..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-100 outline-none text-sm font-bold"
                  value={targetSearch}
                  onChange={e => setTargetSearch(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div 
                  onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${showSelectedOnly ? 'bg-brand-500 border-brand-500 shadow-sm shadow-brand-100' : 'bg-white border-slate-300'}`}
                >
                  {showSelectedOnly && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm font-bold text-slate-600">Sélectionnés uniquement</span>
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-[500px]">
              {users.filter(u => {
                const isNotSelf = u.id !== selectedUser.id
                const matchesSearch = u.nom.toLowerCase().includes(targetSearch.toLowerCase()) || 
                                     u.prenom.toLowerCase().includes(targetSearch.toLowerCase()) ||
                                     u.matricule.toLowerCase().includes(targetSearch.toLowerCase())
                const matchesSelection = showSelectedOnly ? targets.includes(u.id) : true
                return isNotSelf && matchesSearch && matchesSelection
              }).map(user => {
                const isSelected = targets.includes(user.id)
                return (
                  <button
                    key={user.id}
                    onClick={() => handleToggleTarget(user.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelected ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100' : 'bg-white border-slate-100 hover:border-brand-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {user.nom[0]}{user.prenom[0]}
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-bold ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>{user.nom} {user.prenom}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{user.matricule} • {user.role}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300 opacity-40 space-y-4">
            <Users2 className="w-16 h-16" />
            <p className="text-xl font-display font-bold">Sélectionnez un évaluateur</p>
            <p className="text-slate-500 font-medium text-center max-w-xs">Choisissez un participant à gauche pour configurer les personnes qu'il doit évaluer.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Loader2(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
}

function SuiviDashboard({ affectations, users }: { affectations: any[], users: User[] }) {
  // Get all unique evaluateurs from affectations
  const evaluateurIds = [...new Set(affectations.map(a => a.evaluateurId))]
  
  // Calculate statuses
  const trackingData = evaluateurIds.map(evalId => {
    const user = users.find(u => u.id === evalId)
    const userAffectations = affectations.filter(a => a.evaluateurId === evalId)
    // Statut global: Si un seul est TERMINEE, on considère terminé (vu qu'ils soumettent tout en bloc). Sinon BROUILLON, sinon EN_ATTENTE
    const isTerminee = userAffectations.some(a => a.statut === 'TERMINEE')
    const isBrouillon = userAffectations.some(a => a.statut === 'BROUILLON')
    
    let statut = 'EN_ATTENTE'
    if (isTerminee) statut = 'TERMINEE'
    else if (isBrouillon) statut = 'BROUILLON'

    return {
      user: user || { id: evalId, nom: 'Inconnu', prenom: '', matricule: '', role: '' },
      statut,
      totalToEvaluate: userAffectations.length
    }
  })

  const countTerminee = trackingData.filter(d => d.statut === 'TERMINEE').length
  const countBrouillon = trackingData.filter(d => d.statut === 'BROUILLON').length
  const countAttente = trackingData.filter(d => d.statut === 'EN_ATTENTE').length
  const total = trackingData.length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-500 font-bold text-sm">Total Évaluateurs</span>
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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">Détail par évaluateur</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {trackingData.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-medium">
              Aucune affectation définie pour cette campagne.
            </div>
          )}
          {trackingData.map((data, idx) => (
            <div key={idx} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">
                  {data.user.nom?.[0] || '?'}{data.user.prenom?.[0] || '?'}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{data.user.prenom} {data.user.nom}</p>
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
