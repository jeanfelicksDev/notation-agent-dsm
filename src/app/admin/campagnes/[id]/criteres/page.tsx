'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, AlertCircle, ListChecks } from 'lucide-react'

interface Critere {
  id: string
  libelle: string
  description: string | null
  noteMaximale: number
  typeEvaluateur: 'COLLEGUE' | 'MANAGER' | 'TOUS'
}

export default function CampaignCriteresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [criteres, setCriteres] = useState<Critere[]>([])
  const [campaignName, setCampaignName] = useState('')
  const [error, setError] = useState('')

  // Formulaire pour nouveau critère
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCritere, setNewCritere] = useState({
    libelle: '',
    description: '',
    noteMaximale: 5,
    typeEvaluateur: 'COLLEGUE' as const
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/campagnes/${id}`).then(res => res.json()),
      fetch(`/api/admin/campagnes/${id}/criteres`).then(res => res.json())
    ]).then(([campaign, criteresData]) => {
      if (campaign.error) setError(campaign.error)
      else setCampaignName(campaign.libelle)
      
      if (Array.isArray(criteresData)) setCriteres(criteresData)
    }).catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [id])

  const handleAddCritere = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`/api/admin/campagnes/${id}/criteres`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCritere)
      })
      if (res.ok) {
        const added = await res.json()
        setCriteres([...criteres, added])
        setNewCritere({ libelle: '', description: '', noteMaximale: 5, typeEvaluateur: 'COLLEGUE' })
        setShowAddForm(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur lors de l\'ajout')
      }
    } catch (err) {
      setError('Erreur de connexion')
    }
  }

  const handleDeleteCritere = async (critereId: string) => {
    if (!confirm('Supprimer ce critère ?')) return
    try {
      const res = await fetch(`/api/admin/campagnes/${id}/criteres/${critereId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setCriteres(criteres.filter(c => c.id !== critereId))
      }
    } catch (err) {
      alert('Erreur lors de la suppression')
    }
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/admin/campagnes/${id}`} className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Critères de Notation</h1>
              <p className="text-sm text-gray-500">{campaignName}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter un critère
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8 border-2 border-blue-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Nouveau Critère</h2>
            <form onSubmit={handleAddCritere} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={newCritere.libelle}
                    onChange={e => setNewCritere({ ...newCritere, libelle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type d'évaluateur</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    value={newCritere.typeEvaluateur}
                    onChange={e => setNewCritere({ ...newCritere, typeEvaluateur: e.target.value as any })}
                  >
                    <option value="COLLEGUE">Collègues uniquement</option>
                    <option value="MANAGER">Manager uniquement</option>
                    <option value="TOUS">Tous (Collègues & Manager)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-20"
                  value={newCritere.description}
                  onChange={e => setNewCritere({ ...newCritere, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                >
                  <Save className="w-4 h-4" /> Enregistrer
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {criteres.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">
              <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Aucun critère défini pour cette campagne.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 text-blue-600 font-medium hover:underline"
              >
                Ajouter le premier critère
              </button>
            </div>
          ) : (
            criteres.map(critere => (
              <div key={critere.id} className="bg-white rounded-xl shadow-sm border p-6 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-gray-800">{critere.libelle}</h3>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase">
                      {critere.typeEvaluateur}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{critere.description || 'Aucune description'}</p>
                </div>
                <button
                  onClick={() => handleDeleteCritere(critere.id)}
                  className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
