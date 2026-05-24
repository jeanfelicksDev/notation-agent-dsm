'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertCircle, User, Mail, Shield, Building2, Briefcase, Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import AdminHeader from '@/components/AdminHeader'

interface Site {
  id: string
  nom: string
}

interface Manager {
  id: string
  nom: string
  prenom: string
}

export default function NewUtilisateurPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [managers, setManagers] = useState<Manager[]>([])

  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    email: '',
    motDePasse: '',
    role: 'UTILISATEUR',
    service: '',
    siteId: '',
    managerId: ''
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/sites').then(res => res.json()),
      fetch('/api/admin/utilisateurs').then(res => res.json())
    ]).then(([sitesData, usersData]) => {
      setSites(sitesData)
      setManagers(usersData.filter((u: any) => u.role === 'MANAGER' || u.role === 'ADMIN'))
    }).catch(err => console.error('Error fetching initial data:', err))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/utilisateurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/admin/utilisateurs')
      } else {
        setError(data.error || 'Une erreur est survenue')
      }
    } catch (err) {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Nouvel Utilisateur" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <Link href="/admin/utilisateurs" className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors animate-fade-in">
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" /> Retour à la liste
            </Link>

            <div className="glass rounded-3xl p-8 border border-slate-200/50 shadow-sm animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="mb-8 flex items-center gap-4">
                <div className="w-12 h-12 premium-gradient rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-100">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-slate-900">Profil Collaborateur</h2>
                  <p className="text-slate-500 text-sm font-medium">Informations d'identification et accès système.</p>
                </div>
              </div>

              {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <p className="font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matricule *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold uppercase"
                        value={formData.matricule}
                        onChange={e => setFormData({ ...formData, matricule: e.target.value.toUpperCase() })}
                        placeholder="Ex: MAT-001"
                      />
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email *</label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@dsm.com"
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold"
                      value={formData.nom}
                      onChange={e => setFormData({ ...formData, nom: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prénom *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold"
                      value={formData.prenom}
                      onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service / Département</label>
                    <input
                      type="text"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold"
                      value={formData.service}
                      onChange={e => setFormData({ ...formData, service: e.target.value })}
                      placeholder="Ex: Comptabilité"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rôle Système</label>
                    <div className="relative">
                      <select
                        className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold appearance-none"
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                      >
                        <option value="UTILISATEUR">Utilisateur (Agent)</option>
                        <option value="MANAGER">Manager</option>
                        <option value="ADMIN">Administrateur</option>
                        <option value="EXTERNE">Externe (Client / Autre)</option>
                      </select>
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Affectation Site</label>
                    <div className="relative">
                      <select
                        className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold appearance-none"
                        value={formData.siteId}
                        onChange={e => setFormData({ ...formData, siteId: e.target.value })}
                      >
                        <option value="">Sélectionner un site</option>
                        {sites.map(site => (
                          <option key={site.id} value={site.id}>{site.nom}</option>
                        ))}
                      </select>
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Manager Hiérarchique</label>
                    <div className="relative">
                      <select
                        className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold appearance-none"
                        value={formData.managerId}
                        onChange={e => setFormData({ ...formData, managerId: e.target.value })}
                      >
                        <option value="">Aucun manager</option>
                        {managers.map(manager => (
                          <option key={manager.id} value={manager.id}>{manager.nom} {manager.prenom}</option>
                        ))}
                      </select>
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mot de passe provisoire *</label>
                    <input
                      type="password"
                      required
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-100 focus:border-brand-500 transition-all outline-none font-bold"
                      value={formData.motDePasse}
                      onChange={e => setFormData({ ...formData, motDePasse: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
                  <Link
                    href="/admin/utilisateurs"
                    className="px-8 py-3.5 border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition-all active:scale-[0.98]"
                  >
                    Annuler
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-3.5 rounded-2xl font-black shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Créer le profil
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
