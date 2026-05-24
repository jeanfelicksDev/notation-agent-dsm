'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Building2, MapPin, Users, ChevronRight } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
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

  useEffect(() => {
    fetch('/api/admin/sites')
      .then(res => res.json())
      .then(data => setSites(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
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
                          <Link 
                            href={`/admin/sites/${site.id}`} 
                            className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-bold text-sm bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Détails <ChevronRight className="w-4 h-4" />
                          </Link>
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
      </div>
    </div>
  )
}