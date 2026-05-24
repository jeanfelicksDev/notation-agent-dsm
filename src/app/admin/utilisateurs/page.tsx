'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Plus, User, Mail, Building2, ChevronRight, BadgeCheck, ShieldAlert, UserCog, FileSpreadsheet, Upload, X, Loader2, CheckCircle2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import AdminHeader from '@/components/AdminHeader'

interface Utilisateur {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
  role: string
  site: { nom: string } | null
}

export default function UtilisateursPage() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success?: boolean; message?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchUsers = () => {
    setLoading(true)
    fetch('/api/admin/utilisateurs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUtilisateurs(data)
        } else {
          setUtilisateurs([])
        }
      })
      .catch(() => setUtilisateurs([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/utilisateurs/import', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setImportResult({ success: true, message: data.message })
        fetchUsers()
      } else {
        setImportResult({ success: false, message: data.error })
      }
    } catch (err) {
      setImportResult({ success: false, message: "Une erreur est survenue lors de l'envoi." })
    } finally {
      setImporting(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            <ShieldAlert className="w-3 h-3" /> ADMIN
          </span>
        )
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
            <UserCog className="w-3 h-3" /> MANAGER
          </span>
        )
      case 'EXTERNE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            EXTERNE
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
            <BadgeCheck className="w-3 h-3" /> AGENT
          </span>
        )
    }
  }

  if (loading && utilisateurs.length === 0) {
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
        <AdminHeader title="Gestion des Utilisateurs" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div>
                <p className="text-slate-500 font-medium">Gérez les accès et les rôles de vos collaborateurs.</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Participants
                </button>
                <Link 
                  href="/admin/utilisateurs/new" 
                  className="inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-100 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" /> Nouvel utilisateur
                </Link>
              </div>
            </div>

            <div className="glass rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Collaborateur</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Matricule</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Site</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rôle</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {utilisateurs.map((user) => (
                      <tr key={user.id} className="hover:bg-brand-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 premium-gradient rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm group-hover:scale-110 transition-transform">
                              {user.nom[0]}{user.prenom[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{user.nom} {user.prenom}</span>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Mail className="w-3 h-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {user.matricule}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium">{user.site?.nom || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getRoleBadge(user.role)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link 
                            href={`/admin/utilisateurs/${user.id}`} 
                            className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-bold text-sm bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Éditer <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {utilisateurs.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-40">
                            <User className="w-12 h-12" />
                            <p className="text-slate-500 font-medium">Aucun collaborateur enregistré.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-display font-bold text-slate-900">Charger des participants</h3>
              <button onClick={() => { setShowImportModal(false); setImportResult(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8">
              {!importResult ? (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <p className="text-slate-500 font-medium">Sélectionnez le fichier Excel (.xlsx) contenant la liste des agents.</p>
                    <p className="text-xs text-slate-400 italic">Le fichier doit contenir les colonnes: Matricule, Nom, Prénoms, Site, Status...</p>
                  </div>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                      importing ? 'bg-slate-50 border-slate-200' : 'hover:border-brand-500 hover:bg-brand-50/30 border-slate-200'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImport} 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      disabled={importing}
                    />
                    {importing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
                        <span className="text-sm font-bold text-brand-600">Importation en cours...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-500">
                          <Upload className="w-8 h-8" />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-700">Cliquez pour parcourir</p>
                          <p className="text-xs text-slate-400">Excel ou CSV supporté</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-6 py-4">
                  <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${importResult.success ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                    {importResult.success ? <CheckCircle2 className="w-12 h-12" /> : <ShieldAlert className="w-12 h-12" />}
                  </div>
                  <div className="space-y-2">
                    <h4 className={`text-xl font-bold ${importResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                      {importResult.success ? 'Import réussi' : 'Échec de l\'import'}
                    </h4>
                    <p className="text-slate-500 font-medium">{importResult.message}</p>
                  </div>
                  <button 
                    onClick={() => { setShowImportModal(false); setImportResult(null); }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg"
                  >
                    Fermer
                  </button>
                </div>
              )}
            </div>
            
            {!importResult && (
              <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                <Link href="/templates/modele-import-agents.xlsx" className="text-xs font-bold text-brand-600 hover:underline">Télécharger le modèle Excel</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}