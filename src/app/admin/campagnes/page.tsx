'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Calendar, CheckCircle, Clock, XCircle, ChevronRight, BarChart3, Users2, ClipboardList, Trophy } from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'

interface Campagne {
  id: string
  libelle: string
  dateDebut: string
  dateFin: string
  statut: string
  poidsCollegues: number
  poidsManager: number
  _count: { criteres: number; affectations: number }
}

export default function CampagnesPage() {
  const [campagnes, setCampagnes] = useState<Campagne[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/campagnes')
      .then(res => {
        if (res.status === 401) {
          window.location.href = '/api/auth/login'
          return null
        }
        return res.json()
      })
      .then(data => {
        if (!data) return
        if (Array.isArray(data)) {
          setCampagnes(data)
        } else {
          console.error("API Error:", data)
          setCampagnes([])
        }
      })
      .catch(err => {
        console.error("Fetch error:", err)
        setCampagnes([])
      })
      .finally(() => setLoading(false))
  }, [])

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'OUVERTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Clock className="w-3.5 h-3.5" /> OUVERTE
          </span>
        )
      case 'CLOTUREE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            <XCircle className="w-3.5 h-3.5" /> CLÔTURÉE
          </span>
        )
      case 'CALCULEE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
            <CheckCircle className="w-3.5 h-3.5" /> CALCULÉE
          </span>
        )
      default:
        return null
    }
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin"></div>
      </div>
    )
  }

  const years = Array.from(new Set(campagnes
    .map(c => c.dateDebut ? new Date(c.dateDebut).getFullYear() : null)
    .filter((y): y is number => y !== null && !isNaN(y))
  ))
  const sortedYears = years.length > 0 ? years.sort((a, b) => b - a) : [new Date().getFullYear()]
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // Met à jour l'année par défaut quand les campagnes sont chargées
  useEffect(() => {
    if (campagnes.length > 0) {
      const availableYears = Array.from(new Set(campagnes
        .map(c => c.dateDebut ? new Date(c.dateDebut).getFullYear() : null)
        .filter((y): y is number => y !== null && !isNaN(y))
      ))
      const sorted = availableYears.sort((a, b) => b - a)
      if (sorted.length > 0 && !availableYears.includes(selectedYear)) {
        setSelectedYear(sorted[0])
      }
    }
  }, [campagnes, selectedYear])

  return (
    <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Gestion des Campagnes" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div>
                <p className="text-slate-500 font-medium">Suivez et configurez vos sessions d'évaluation.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-4 py-2.5 bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer border-r border-slate-200 hover:bg-slate-50"
                  >
                    {sortedYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <Link 
                    href={`/admin/classement?campagneId=ANNUEL_${selectedYear}`}
                    className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 font-bold transition-all active:scale-95"
                    title="Générer le palmarès annuel"
                  >
                    <Trophy className="w-4 h-4" /> 
                    <span className="hidden sm:inline">Palmarès Annuel</span>
                  </Link>
                </div>
                <Link 
                  href="/admin/campagnes/new" 
                  className="inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-100 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" /> Nouvelle campagne
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {campagnes.map((campagne, index) => (
                <div 
                  key={campagne.id} 
                  className="animate-fade-in group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="glass card-hover rounded-2xl border border-slate-200/50 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 overflow-hidden relative">
                    {/* Background accent */}
                    <div className="absolute top-0 left-0 w-1.5 h-full premium-gradient opacity-80"></div>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-display font-bold text-slate-900">{campagne.libelle}</h3>
                        {getStatutBadge(campagne.statut)}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium">{formatDate(campagne.dateDebut)} — {formatDate(campagne.dateFin)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <BarChart3 className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium">{campagne._count.criteres} critères d'évaluation</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Users2 className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium">{campagne._count.affectations} agents concernés</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 lg:border-l border-slate-100 lg:pl-8">
                      <div className="hidden sm:block">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pondération</p>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">Collègues</span>
                            <span className="text-xs text-brand-500">{campagne.poidsCollegues}%</span>
                          </div>
                          <div className="w-px h-6 bg-slate-200 mx-1"></div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">Manager</span>
                            <span className="text-xs text-amber-500">{campagne.poidsManager}%</span>
                          </div>
                        </div>
                      </div>

                      <Link 
                        href={`/admin/campagnes/${campagne.id}`} 
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                      >
                        Gérer la session <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {campagnes.length === 0 && (
                <div className="glass rounded-2xl border border-dashed border-slate-300 p-12 text-center animate-fade-in">
                  <div className="flex flex-col items-center gap-4 opacity-30">
                    <ClipboardList className="w-16 h-16" />
                    <div className="space-y-1">
                      <p className="text-xl font-display font-bold">Aucune campagne</p>
                      <p className="text-slate-500 font-medium">Commencez par créer votre première session d'évaluation.</p>
                    </div>
                  </div>
                  <Link 
                    href="/admin/campagnes/new" 
                    className="mt-8 inline-flex items-center gap-2 text-brand-600 font-bold hover:underline"
                  >
                    <Plus className="w-5 h-5" /> Créer une campagne
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>
    </div>
  )
}