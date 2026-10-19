'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, AlertCircle, QrCode, KeyRound, Eye, EyeOff, Check } from 'lucide-react'
import { confirmer, toast } from '@/components/ui/feedback'

interface Site {
  id: string
  nom: string
}

export default function UtilisateurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    role: 'UTILISATEUR',
    service: '',
    departement: '',
    direction: '',
    siteId: '',
    qrcodeActif: false,
  })

  // Password change state (ADMIN only)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/utilisateurs/${id}`).then(res => res.json()),
      fetch('/api/admin/sites').then(res => res.json())
    ]).then(([userData, sitesData]) => {
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
          service: userData.service || '',
          departement: userData.departement || '',
          direction: userData.direction || '',
          siteId: userData.siteId || '',
          qrcodeActif: userData.qrcodeActif || false,
        })
      }
      setSites(Array.isArray(sitesData) ? sitesData : [])
    })
    .catch(() => setError('Erreur de chargement'))
    .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setPwdError('')
    setPwdSuccess(false)

    // Validate password if provided
    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setPwdError('Le mot de passe doit contenir au moins 8 caractères.')
        setSaving(false)
        return
      }
      if (newPassword !== confirmPassword) {
        setPwdError('Les mots de passe ne correspondent pas.')
        setSaving(false)
        return
      }
    }

    try {
      const payload: any = {
        matricule: formData.matricule,
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        telephone: formData.telephone,
        role: formData.role,
        service: formData.service,
        departement: formData.departement,
        direction: formData.direction,
        siteId: formData.siteId || null,
        qrcodeActif: formData.qrcodeActif,
      }

      if (formData.role === 'ADMIN' && newPassword.trim().length >= 8) {
        payload.motDePasse = newPassword.trim()
      }

      const res = await fetch(`/api/admin/utilisateurs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        if (formData.role === 'ADMIN' && newPassword.trim().length >= 8) {
          setPwdSuccess(true)
          setNewPassword('')
          setConfirmPassword('')
        }
        router.push('/admin/utilisateurs')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur lors de la mise à jour')
      }
    } catch (err) {
      setError('Erreur de connexion')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const ok = await confirmer({
      titre: 'Supprimer cet utilisateur ?',
      message: 'Ses notes données et reçues, ses affectations et ses scores seront définitivement supprimés.',
      confirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/admin/utilisateurs/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Utilisateur supprimé.')
        router.push('/admin/utilisateurs')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'La suppression a échoué.')
      }
    } catch {
      toast.error('Connexion au serveur impossible.')
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gray-50">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none uppercase bg-white focus:ring-2 focus:ring-navy-400"
                  value={formData.matricule}
                  onChange={e => setFormData({ ...formData, matricule: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Utilisé pour l'envoi du code de connexion</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
                  value={formData.prenom}
                  onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
                  value={formData.service}
                  onChange={e => setFormData({ ...formData, service: e.target.value })}
                  placeholder="ex: Facturation, Opérations..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
                  value={formData.departement}
                  onChange={e => setFormData({ ...formData, departement: e.target.value })}
                  placeholder="ex: Dsm, Manut, Entrepot..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-600 outline-none"
                  value={formData.direction}
                  onChange={e => setFormData({ ...formData, direction: e.target.value })}
                  placeholder="ex: Direction des Opérations..."
                />
              </div>



              {/* QR Code checkbox */}
              <div className="md:col-span-2">
                <label
                  htmlFor="qrcode-actif"
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all select-none ${
                    formData.qrcodeActif
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <input
                    id="qrcode-actif"
                    type="checkbox"
                    className="sr-only"
                    checked={formData.qrcodeActif}
                    onChange={e => setFormData({ ...formData, qrcodeActif: e.target.checked })}
                  />
                  {/* Custom checkbox */}
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    formData.qrcodeActif
                      ? 'bg-amber-400 border-amber-400'
                      : 'bg-white border-slate-300'
                  }`}>
                    {formData.qrcodeActif && (
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      formData.qrcodeActif ? 'bg-amber-400' : 'bg-slate-200'
                    }`}>
                      <QrCode className={`w-5 h-5 ${formData.qrcodeActif ? 'text-white' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${
                        formData.qrcodeActif ? 'text-amber-800' : 'text-slate-700'
                      }`}>Inclure dans la notation par QR Code unique</p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        Permet à cet agent de figurer dans la liste des agents sélectionnables lorsque les clients scannent le QR code unique.
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* PIN d'un agent : réinitialisation uniquement (l'agent le choisit lui-même) */}
            {(formData.role === 'UTILISATEUR' || formData.role === 'MANAGER') && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy-900">Code PIN</p>
                  <p className="text-sm text-slate-600">L’agent choisit lui-même son PIN à sa première connexion. En cas d’oubli, réinitialisez-le.</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirmer({
                      titre: 'Réinitialiser le PIN ?',
                      message: 'Le PIN actuel est effacé et les sessions de l’agent sont fermées. Il en choisira un nouveau à sa prochaine connexion.',
                      confirmer: 'Réinitialiser le PIN',
                    })
                    if (!ok) return
                    const res = await fetch(`/api/admin/utilisateurs/${id}/reinitialiser-pin`, { method: 'POST' })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) toast.success('PIN réinitialisé.')
                    else toast.error(data.error || 'La réinitialisation a échoué.')
                  }}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4" aria-hidden />
                  Réinitialiser le PIN
                </button>
              </div>
            )}

            {/* Password change section — ADMIN only */}
            {formData.role === 'ADMIN' && (
              <div className="mt-4 p-5 border-2 border-navy-100 bg-navy-50 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-navy-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <KeyRound className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-navy-950 text-sm">Changer le mot de passe</p>
                    <p className="text-xs text-navy-700">Laissez vide pour conserver le mot de passe actuel.</p>
                  </div>
                </div>

                {pwdError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{pwdError}</span>
                  </div>
                )}
                {pwdSuccess && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>Mot de passe mis à jour avec succès !</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-navy-900 mb-1 uppercase tracking-wide">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setPwdError('') }}
                        className="w-full px-4 py-2 pr-10 border border-navy-200 rounded-lg focus:ring-2 focus:ring-navy-400 outline-none bg-white text-sm"
                        placeholder="Nouveau mot de passe"
                        minLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-800"
                      >
                        {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-navy-900 mb-1 uppercase tracking-wide">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input
                        type={showConfirmPwd ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => { setConfirmPassword(e.target.value); setPwdError('') }}
                        className="w-full px-4 py-2 pr-10 border border-navy-200 rounded-lg focus:ring-2 focus:ring-navy-400 outline-none bg-white text-sm"
                        placeholder="Répétez le mot de passe"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-800"
                      >
                        {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                className="flex items-center gap-2 bg-navy-700 hover:bg-navy-800 text-white px-8 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors"
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
