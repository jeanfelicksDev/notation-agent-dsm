'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, AlertCircle } from 'lucide-react'

interface Site {
  id: string
  nom: string
}

interface Manager {
  id: string
  nom: string
  prenom: string
}

export default function UtilisateurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [managers, setManagers] = useState<Manager[]>([])

  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    role: 'UTILISATEUR',
    siteId: '',
    managerId: ''
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/utilisateurs/${id}`).then(res => res.json()),
      fetch('/api/admin/sites').then(res => res.json()),
      fetch('/api/admin/utilisateurs').then(res => res.json())
    ]).then(([userData, sitesData, allUsers]) => {
      if (userData.error) {
        setError(userData.error)
      } else {
        setFormData({
          matricule: userData.matricule,
          nom: userData.nom,
          prenom: userData.prenom,
          email: userData.email,
          telephone: userData.telephone || '',
          role: userData.role,
          siteId: userData.siteId || '',
          managerId: userData.managerId || ''
        })
      }
      setSites(sitesData)
      setManagers(allUsers.filter((u: any) => u.id !== id && (u.role === 'MANAGER' || u.role === 'ADMIN')))
    })
    .catch(() => setError('Erreur de chargement'))
    .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/utilisateurs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        router.push('/admin/utilisateurs')
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

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return

    try {
      const res = await fetch(`/api/admin/utilisateurs/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/utilisateurs')
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (err) {
      alert('Erreur de connexion')
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
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/utilisateurs" className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Détails de l'Utilisateur</h1>
          </div>
          <button
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-md p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matricule *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none uppercase bg-gray-50"
                  value={formData.matricule}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Utilisé pour l'envoi du code de connexion</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.telephone}
                  onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="+225 07 00 00 00 00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.prenom}
                  onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="UTILISATEUR">Utilisateur</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.siteId}
                  onChange={e => setFormData({ ...formData, siteId: e.target.value })}
                >
                  <option value="">Sélectionner un site</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.managerId}
                  onChange={e => setFormData({ ...formData, managerId: e.target.value })}
                >
                  <option value="">Aucun manager</option>
                  {managers.map(manager => (
                    <option key={manager.id} value={manager.id}>{manager.nom} {manager.prenom}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Link
                href="/admin/utilisateurs"
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
    </div>
  )
}
