'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertCircle, User, Mail, Briefcase, Loader2, QrCode } from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'
import { SEXES } from '@/lib/agents'
import { valeurParDefaut } from '@/lib/listes'
import { ChampListe, useListes } from '@/components/listes'

export default function NewUtilisateurPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    email: '',
    motDePasse: '',
    role: 'UTILISATEUR',
    sexe: '',
    nationalite: '',
    emploi: '',
    service: '',
    departement: '',
    direction: '',
    qrcodeActif: false,
  })
  // Valeurs marquées « par défaut » dans les listes (ex. la direction), une fois les listes chargées
  const { listes, setListes } = useListes((l) =>
    setFormData((f) => ({
      ...f,
      nationalite: f.nationalite || valeurParDefaut(l, 'NATIONALITE'),
      service: f.service || valeurParDefaut(l, 'SERVICE'),
      departement: f.departement || valeurParDefaut(l, 'DEPARTEMENT'),
      direction: f.direction || valeurParDefaut(l, 'DIRECTION'),
    }))
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/utilisateurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/admin/utilisateurs')
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
    <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader title="Nouvel Utilisateur" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <Link href="/admin/utilisateurs" className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" /> Retour à la liste
            </Link>

            <div className="bg-white shadow-card rounded-3xl p-8 border border-slate-200/50 shadow-sm">
              <div className="mb-8 flex items-center gap-4">
                <div className="w-12 h-12 bg-navy-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-navy-100">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Profil Collaborateur</h2>
                  <p className="text-slate-500 text-sm font-medium">Informations d'identification et accès système.</p>
                </div>
              </div>

              {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <p className="font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matricule *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold uppercase"
                        value={formData.matricule}
                        onChange={e => setFormData({ ...formData, matricule: e.target.value.toUpperCase() })}
                        placeholder="Ex: MAT-001"
                      />
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email *</label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        className="w-full px-5 py-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@dsm.com"
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                      value={formData.nom}
                      onChange={e => setFormData({ ...formData, nom: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prénom *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                      value={formData.prenom}
                      onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="sexe" className="ml-1 block text-sm font-medium text-slate-700">Sexe</label>
                    <select
                      id="sexe"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                      value={formData.sexe}
                      onChange={e => setFormData({ ...formData, sexe: e.target.value })}
                    >
                      <option value="">Non renseigné</option>
                      {SEXES.map(s => (
                        <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                      ))}
                    </select>
                  </div>

                  <ChampListe
                    id="nationalite"
                    label="Nationalité"
                    liste="NATIONALITE"
                    value={formData.nationalite}
                    onChange={(v) => setFormData((f) => ({ ...f, nationalite: v }))}
                    listes={listes}
                    onListes={setListes}
                    labelClassName="ml-1 block text-sm font-medium text-slate-700"
                    selectClassName="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                  />

                  <div className="space-y-2">
                    <label htmlFor="emploi" className="ml-1 block text-sm font-medium text-slate-700">Emploi</label>
                    <input
                      id="emploi"
                      type="text"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                      value={formData.emploi}
                      onChange={e => setFormData({ ...formData, emploi: e.target.value })}
                      placeholder="Ex : Agent de transit"
                    />
                  </div>

                  <ChampListe
                    id="service"
                    label="Service"
                    liste="SERVICE"
                    value={formData.service}
                    onChange={(v) => setFormData((f) => ({ ...f, service: v }))}
                    listes={listes}
                    onListes={setListes}
                    labelClassName="ml-1 block text-sm font-medium text-slate-700"
                    selectClassName="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                  />

                  <ChampListe
                    id="departement"
                    label="Département"
                    liste="DEPARTEMENT"
                    value={formData.departement}
                    onChange={(v) => setFormData((f) => ({ ...f, departement: v }))}
                    listes={listes}
                    onListes={setListes}
                    labelClassName="ml-1 block text-sm font-medium text-slate-700"
                    selectClassName="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                  />

                  <ChampListe
                    id="direction"
                    label="Direction"
                    liste="DIRECTION"
                    value={formData.direction}
                    onChange={(v) => setFormData((f) => ({ ...f, direction: v }))}
                    listes={listes}
                    onListes={setListes}
                    labelClassName="ml-1 block text-sm font-medium text-slate-700"
                    selectClassName="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                  />

                  <ChampListe
                    id="role"
                    label="Rôle"
                    liste="ROLE"
                    value={formData.role}
                    onChange={(v) => setFormData((f) => ({ ...f, role: v }))}
                    listes={listes}
                    onListes={setListes}
                    labelClassName="ml-1 block text-sm font-medium text-slate-700"
                    selectClassName="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                  />




                  {formData.role === 'ADMIN' ? (
                    <div className="md:col-span-2 space-y-2">
                      <label htmlFor="mdp" className="ml-1 block text-sm font-medium text-slate-700">Mot de passe administrateur (8 caractères minimum) *</label>
                      <input
                        id="mdp"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-navy-100 focus:border-navy-700 transition-all outline-none font-bold"
                        value={formData.motDePasse}
                        onChange={e => setFormData({ ...formData, motDePasse: e.target.value })}
                      />
                    </div>
                  ) : (
                    <p className="md:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      L’agent choisira lui-même son code PIN à 4 chiffres lors de sa première connexion.
                    </p>
                  )}

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

                <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
                  <Link
                    href="/admin/utilisateurs"
                    className="px-8 py-3.5 border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition-all active:scale-[0.98]"
                  >
                    Annuler
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-3.5 rounded-2xl font-black shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Créer le profil
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
    </div>
  )
}
