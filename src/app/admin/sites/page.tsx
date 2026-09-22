'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Building2, MapPin, Users, ChevronRight, Trash2, Loader2 } from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'

interface Site {
  id: string
  nom: string
  ville: string | null
  _count: { utilisateurs: number }
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadSites = () => {
    fetch('/api/admin/sites')
      .then(res => res.json())
      .then(data => setSites(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSites()
  }, [])

  const handleDelete = async () => {
    if (!siteToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/sites/${siteToDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setSiteToDelete(null)
        loadSites()
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (err) {
      alert('Erreur de connexion')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Gestion des Sites" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div>
                <p className="text-slate-500 font-medium">Gérez les emplacements physiques de votre organisation.</p>
              </div>
              <Link 
                href="/admin/sites/new" 
                className="inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-100 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" /> Nouveau site
              </Link>
            </div>

            <div className="glass rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Site</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Localisation</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Effectif</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sites.map((site) => (
                      <tr key={site.id} className="hover:bg-brand-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-slate-900">{site.nom}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium">{site.ville || 'Non spécifiée'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-700">{site._count.utilisateurs} agents</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSiteToDelete(site)}
                              className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 font-bold text-sm bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100"
                              title="Supprimer ce site"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <Link 
                              href={`/admin/sites/${site.id}`} 
                              className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-bold text-sm bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Détails <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {sites.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-40">
                            <Building2 className="w-12 h-12" />
                            <p className="text-slate-500 font-medium">Aucun site enregistré pour le moment.</p>
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

        {/* Delete Confirmation Modal */}
        {siteToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-slate-900">Confirmer la suppression</h3>
                <p className="text-sm text-slate-500">
                  Êtes-vous sûr de vouloir supprimer le site <strong className="text-slate-800">{siteToDelete.nom}</strong> ? Les collaborateurs affectés seront simplement dissociés sans être supprimés.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSiteToDelete(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Oui, supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}