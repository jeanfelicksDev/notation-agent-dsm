'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Building2, ClipboardList, Trophy, Plus, ArrowRight } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import AdminHeader from '@/components/AdminHeader'

interface Stats {
  totalUtilisateurs: number
  totalSites: number
  totalCampagnes: number
  campagnesOuvertes: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUtilisateurs: 0,
    totalSites: 0,
    totalCampagnes: 0,
    campagnesOuvertes: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { title: 'Utilisateurs', value: stats.totalUtilisateurs, icon: Users, href: '/admin/utilisateurs', color: 'text-brand-500', bg: 'bg-brand-50' },
    { title: 'Sites', value: stats.totalSites, icon: Building2, href: '/admin/sites', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { title: 'Campagnes', value: stats.totalCampagnes, icon: ClipboardList, href: '/admin/campagnes', color: 'text-purple-500', bg: 'bg-purple-50' },
    { title: 'Classement', value: '-', icon: Trophy, href: '/admin/classement', color: 'text-amber-500', bg: 'bg-amber-50' },
  ]

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
        <AdminHeader />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="animate-fade-in">
              <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Tableau de bord</h2>
              <p className="text-slate-500 font-medium">Vue d'ensemble de la performance globale.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {cards.map((card, index) => (
                <Link key={card.href} href={card.href} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <div className="glass card-hover rounded-2xl p-6 h-full border border-slate-200/50 shadow-sm flex flex-col">
                    <div className={`${card.bg} ${card.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                      <card.icon className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-500 tracking-wide uppercase">{card.title}</p>
                      <p className="text-3xl font-display font-bold text-slate-900">{card.value}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center text-xs font-bold text-brand-600">
                      Gérer <ArrowRight className="w-3 h-3 ml-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6 animate-fade-in" style={{ animationDelay: '400ms' }}>
                <h3 className="text-xl font-display font-bold text-slate-800">Actions rapides</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Link href="/admin/campagnes/new" className="group p-6 bg-white border border-slate-200 rounded-2xl hover:border-brand-500 transition-all card-hover">
                    <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                      <Plus className="w-5 h-5 text-brand-600 group-hover:text-white" />
                    </div>
                    <span className="font-bold text-slate-800 block mb-1">Campagne</span>
                    <span className="text-xs text-slate-500">Lancer une session</span>
                  </Link>
                  <Link href="/admin/utilisateurs/new" className="group p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 transition-all card-hover">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      <Plus className="w-5 h-5 text-emerald-600 group-hover:text-white" />
                    </div>
                    <span className="font-bold text-slate-800 block mb-1">Utilisateur</span>
                    <span className="text-xs text-slate-500">Ajouter un agent</span>
                  </Link>
                  <Link href="/admin/sites/new" className="group p-6 bg-white border border-slate-200 rounded-2xl hover:border-purple-500 transition-all card-hover">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                      <Plus className="w-5 h-5 text-purple-600 group-hover:text-white" />
                    </div>
                    <span className="font-bold text-slate-800 block mb-1">Site</span>
                    <span className="text-xs text-slate-500">Nouvel emplacement</span>
                  </Link>
                </div>
              </div>

              <div className="space-y-6 animate-fade-in" style={{ animationDelay: '500ms' }}>
                <h3 className="text-xl font-display font-bold text-slate-800">État du système</h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Campagnes actives</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                      {stats.campagnesOuvertes} En cours
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Base de données</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      Opérationnel
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}