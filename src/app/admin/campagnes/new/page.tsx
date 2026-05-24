'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertCircle, Calendar } from 'lucide-react'

export default function NewCampagnePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    libelle: '',
    dateDebut: '',
    dateFin: '',
    poidsCollegues: 45,
    poidsManager: 55
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/campagnes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/admin/campagnes')
        router.refresh()
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/admin/campagnes" className="text-gray-600 hover:text-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Nouvelle Campagne</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-md p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Libellé de la campagne *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.libelle}
                onChange={e => setFormData({ ...formData, libelle: e.target.value })}
                placeholder="Ex: Évaluation Annuelle 2026"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pl-10"
                    value={formData.dateDebut}
                    onChange={e => setFormData({ ...formData, dateDebut: e.target.value })}
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin *</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pl-10"
                    value={formData.dateFin}
                    onChange={e => setFormData({ ...formData, dateFin: e.target.value })}
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poids Collègues (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.poidsCollegues}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0
                    setFormData({ ...formData, poidsCollegues: val, poidsManager: 100 - val })
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poids Manager (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.poidsManager}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0
                    setFormData({ ...formData, poidsManager: val, poidsCollegues: 100 - val })
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Link
                href="/admin/campagnes"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Annuler
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors"
              >
                {loading ? 'Création...' : <><Save className="w-4 h-4" /> Créer la campagne</>}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
