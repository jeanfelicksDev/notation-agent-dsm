'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Medal, Award } from 'lucide-react'

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
      .then(res => res.json())
      .then(data => setSiteScores(data))
      .finally(() => setLoading(false))
  }, [])

  const getMedalIcon = (rang: number) => {
    switch (rang) {
      case 1: return <Trophy className="w-6 h-6 text-yellow-500" />
      case 2: return <Medal className="w-6 h-6 text-gray-400" />
      case 3: return <Award className="w-6 h-6 text-amber-600" />
      default: return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-medium">{rang}</span>
    }
  }

  const getRowClass = (rang: number) => {
    if (rang === 1) return 'bg-yellow-50 border-yellow-200'
    if (rang === 2) return 'bg-gray-50'
    if (rang === 3) return 'bg-amber-50'
    return ''
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-gray-600 hover:text-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Classement par Site</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {siteScores.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
            Aucun classement disponible. Lancez une campagne d'évaluation et CALCULEZ les scores.
          </div>
        ) : (
          <div className="grid gap-6 overflow-x-auto">
            {siteScores.map((site) => (
              <div key={site.siteNom} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <h2 className="text-xl font-bold text-white">{site.siteNom}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 w-16">Rang</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Matricule</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nom</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Prénom</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Collègues (45%)</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Manager (55%)</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {site.scores.map((score) => (
                        <tr key={score.utilisateurId} className={`hover:bg-gray-50 ${getRowClass(score.rang)}`}>
                          <td className="px-4 py-3">{getMedalIcon(score.rang)}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{score.matricule}</td>
                          <td className="px-4 py-3 text-gray-600">{score.nom}</td>
                          <td className="px-4 py-3 text-gray-600">{score.prenom}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{score.scoreCollegues.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{score.scoreManager.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${score.rang === 1 ? 'text-yellow-600' : 'text-blue-600'}`}>
                              {score.scoreTotal.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
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