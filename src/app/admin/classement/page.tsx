'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Medal, Award, Gift, Info } from 'lucide-react'
import { getAppreciationInfo } from '@/lib/default-criteres'

interface Score {
  utilisateurId: string
  matricule: string
  nom: string
  prenom: string
  scoreTotal: number
  rang: number
  scoreCollegues: number
  scoreManager: number
}

interface SiteScores {
  siteNom: string
  scores: Score[]
}

export default function ClassementPage() {
  const [siteScores, setSiteScores] = useState<SiteScores[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/classement')
      .then((res) => res.json())
      .then((data) => setSiteScores(data))
      .finally(() => setLoading(false))
  }, [])

  const getMedalIcon = (rang: number) => {
    switch (rang) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />
      case 2:
        return <Medal className="w-6 h-6 text-slate-400" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-slate-500 font-medium">
            {rang}
          </span>
        )
    }
  }

  const getRowClass = (rang: number) => {
    if (rang === 1) return 'bg-yellow-50/60 border-yellow-200 font-semibold'
    if (rang === 2) return 'bg-slate-50/60'
    if (rang === 3) return 'bg-amber-50/40'
    return ''
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-600 hover:text-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Classement & Résultats DSM</h1>
              <p className="text-xs text-slate-500 font-medium">
                Évaluation 360° : Collègues (45%) + Manager (55%)
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Banner Récompenses des Lauréats */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-yellow-400 font-extrabold text-xs uppercase tracking-widest mb-2">
                <Gift className="w-4 h-4" /> Récompenses officielles des lauréats DSM
              </div>
              <h2 className="text-xl font-black">Grille des Distinctions & Primes</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <div className="text-xs font-bold text-slate-300">Meilleur Agent Cellule</div>
                <div className="text-lg font-black text-yellow-400">500 000 FCFA</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <div className="text-xs font-bold text-slate-300">Meilleur Département</div>
                <div className="text-lg font-black text-yellow-400">1 000 000 FCFA</div>
              </div>
              <div className="bg-yellow-400/20 backdrop-blur-md rounded-2xl p-3 border border-yellow-400/30 text-center">
                <div className="text-xs font-bold text-yellow-200">Meilleur Agent DSM</div>
                <div className="text-lg font-black text-yellow-300">1 500 000 FCFA</div>
                <div className="text-[10px] text-yellow-100 mt-0.5">
                  + Séjour familial & Gala AGL
                </div>
              </div>
            </div>
          </div>
        </div>

        {siteScores.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-12 text-center text-slate-500 border border-slate-100">
            <Info className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-semibold">Aucun classement disponible pour le moment.</p>
            <p className="text-sm text-slate-400 mt-1">
              Veuillez lancer une campagne d'évaluation et cliquer sur "Calculer les résultats".
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {siteScores.map((site) => (
              <div
                key={site.siteNom}
                className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
              >
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>📍</span> {site.siteNom}
                  </h2>
                  <span className="text-xs text-slate-400 font-semibold bg-slate-800 px-3 py-1 rounded-full">
                    {site.scores.length} agent{site.scores.length > 1 ? 's' : ''} évalué
                    {site.scores.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase font-extrabold tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left w-16">Rang</th>
                        <th className="px-4 py-3 text-left">Matricule</th>
                        <th className="px-4 py-3 text-left">Agent</th>
                        <th className="px-4 py-3 text-right">Collègues (45 pts)</th>
                        <th className="px-4 py-3 text-right">Manager (55 pts)</th>
                        <th className="px-4 py-3 text-right">Score Total</th>
                        <th className="px-4 py-3 text-left pl-6">Appréciation Managériale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {site.scores.map((score) => {
                        const app = getAppreciationInfo(score.scoreTotal)
                        return (
                          <tr
                            key={score.utilisateurId}
                            className={`hover:bg-slate-50/80 transition-colors ${getRowClass(
                              score.rang
                            )}`}
                          >
                            <td className="px-4 py-4">{getMedalIcon(score.rang)}</td>
                            <td className="px-4 py-4 font-mono font-bold text-slate-800">
                              {score.matricule}
                            </td>
                            <td className="px-4 py-4 font-bold text-slate-900">
                              {score.prenom} {score.nom}
                            </td>
                            <td className="px-4 py-4 text-right text-slate-600 font-medium">
                              {score.scoreCollegues.toFixed(1)} / 45
                            </td>
                            <td className="px-4 py-4 text-right text-slate-600 font-medium">
                              {score.scoreManager.toFixed(1)} / 55
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span
                                className={`text-base font-black ${
                                  score.rang === 1 ? 'text-yellow-600' : 'text-blue-600'
                                }`}
                              >
                                {score.scoreTotal.toFixed(1)} %
                              </span>
                            </td>
                            <td className="px-4 py-4 pl-6">
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${app.colorBadge}`}
                                >
                                  {app.appreciation}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {app.interpretation}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}