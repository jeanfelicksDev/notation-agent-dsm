'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, AlertCircle, Users } from 'lucide-react'

interface Site {
  id: string
  nom: string
  ville: string | null
  _count: { utilisateurs: number }
}

export default function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    nom: '',
    ville: ''
  })

  useEffect(() => {
    fetch(`/api/admin/sites/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setFormData({
            nom: data.nom,
            ville: data.ville || ''
          })
        }
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/sites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        router.push('/admin/sites')
        router.refresh()
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

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const executeDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/sites/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/sites')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur lors de la suppression')
        setShowDeleteModal(false)
      }
    } catch (err) {
      setError('Erreur de connexion lors de la suppression')
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/sites" className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Détails du Site</h1>
          </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du Site *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.nom}
                onChange={e => setFormData({ ...formData, nom: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.ville}
                onChange={e => setFormData({ ...formData, ville: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="mr-auto px-5 py-2 text-sm bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg font-bold transition-colors"
              >
                Supprimer ce site
              </button>
              <Link
                href="/admin/sites"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Annuler
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors"
              >
                {saving ? 'Enregistrement...' : <><Save className="w-4 h-4" /> Enregistrer</>}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Custom Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Confirmer la suppression</h3>
              <p className="text-sm text-slate-500">
                Êtes-vous sûr de vouloir supprimer le site <strong className="text-slate-800">{formData.nom || 'ce site'}</strong> ? Les collaborateurs affectés seront simplement dissociés sans être supprimés.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Oui, supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
