'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import AdminHeader from '@/components/AdminHeader'
import { confirmer, toast } from '@/components/ui/feedback'

const QRCode = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })

interface Utilisateur {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string
  telephone?: string | null
  role: string
  service?: string | null
  emploi?: string | null
  departement?: string | null
  qrcodeActif?: boolean
  pinDefini: boolean
  verrouilleJusqua?: string | null
}

type Filtre = 'tous' | 'sans_pin' | 'verrouilles' | 'managers' | 'externes'

const ROLES: Record<string, { label: string; className: string }> = {
  ADMIN: { label: 'Administrateur', className: 'bg-red-50 text-red-800 ring-red-200' },
  MANAGER: { label: 'Manager', className: 'bg-teal-50 text-teal-800 ring-teal-200' },
  EXTERNE: { label: 'Client externe', className: 'bg-gold-50 text-gold-800 ring-gold-200' },
  UTILISATEUR: { label: 'Agent', className: 'bg-navy-50 text-navy-800 ring-navy-200' },
}

const estVerrouille = (u: Utilisateur) => Boolean(u.verrouilleJusqua && new Date(u.verrouilleJusqua) > new Date())

export default function UtilisateursPage() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const params = useSearchParams()
  const [filtre, setFiltre] = useState<Filtre>(() => {
    const f = params.get('filtre')
    return f === 'sans_pin' || f === 'verrouilles' ? f : 'tous'
  })
  const [qrEnCours, setQrEnCours] = useState<string | null>(null)
  const [activationQr, setActivationQr] = useState(false)
  const [importOuvert, setImportOuvert] = useState(false)
  const [qrOuvert, setQrOuvert] = useState(false)

  const recuperer = () =>
    fetch('/api/admin/utilisateurs')
      .then((res) => res.json())
      .then((data) => setUtilisateurs(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Impossible de charger les agents.'))
      .finally(() => setLoading(false))

  const charger = () => {
    setLoading(true)
    recuperer()
  }

  useEffect(() => {
    recuperer()
  }, [])

  const internes = utilisateurs.filter((u) => u.role === 'UTILISATEUR' || u.role === 'MANAGER')
  const compteurs = {
    tous: utilisateurs.length,
    sans_pin: internes.filter((u) => !u.pinDefini).length,
    verrouilles: utilisateurs.filter(estVerrouille).length,
    managers: utilisateurs.filter((u) => u.role === 'MANAGER').length,
    externes: utilisateurs.filter((u) => u.role === 'EXTERNE').length,
  }

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return utilisateurs.filter((u) => {
      if (q && !`${u.nom} ${u.prenom} ${u.matricule} ${u.service ?? ''} ${u.emploi ?? ''} ${u.departement ?? ''} ${u.telephone ?? ''}`.toLowerCase().includes(q)) return false
      if (filtre === 'sans_pin') return (u.role === 'UTILISATEUR' || u.role === 'MANAGER') && !u.pinDefini
      if (filtre === 'verrouilles') return estVerrouille(u)
      if (filtre === 'managers') return u.role === 'MANAGER'
      if (filtre === 'externes') return u.role === 'EXTERNE'
      return true
    })
  }, [utilisateurs, recherche, filtre])

  const basculerQr = async (u: Utilisateur) => {
    setQrEnCours(u.id)
    try {
      const res = await fetch(`/api/admin/utilisateurs/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrcodeActif: !u.qrcodeActif }),
      })
      if (!res.ok) throw new Error()
      setUtilisateurs((prev) => prev.map((x) => (x.id === u.id ? { ...x, qrcodeActif: !u.qrcodeActif } : x)))
    } catch {
      toast.error('La notation QR n’a pas pu être modifiée.')
    } finally {
      setQrEnCours(null)
    }
  }

  const activerTousQr = async () => {
    const ok = await confirmer({
      titre: 'Ouvrir la notation QR à tous les agents ?',
      message: 'Tous les agents et managers pourront être évalués par les clients externes via le QR code.',
      confirmer: 'Activer pour tous',
    })
    if (!ok) return
    setActivationQr(true)
    try {
      const res = await fetch('/api/admin/utilisateurs/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableAllAgents: true }),
      })
      if (!res.ok) throw new Error()
      toast.success('Notation QR activée pour tous les agents.')
      charger()
    } catch {
      toast.error('L’activation a échoué.')
    } finally {
      setActivationQr(false)
    }
  }

  const reinitialiserPin = async (u: Utilisateur) => {
    const ok = await confirmer({
      titre: `Réinitialiser le PIN de ${u.prenom} ${u.nom} ?`,
      message: 'Son PIN actuel est effacé et ses sessions sont fermées. À sa prochaine connexion, il choisira un nouveau PIN.',
      confirmer: 'Réinitialiser le PIN',
    })
    if (!ok) return
    const res = await fetch(`/api/admin/utilisateurs/${u.id}/reinitialiser-pin`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(data.error || 'La réinitialisation a échoué.')
    toast.success(`PIN réinitialisé. ${u.prenom} choisira un nouveau PIN à sa prochaine connexion.`)
    setUtilisateurs((prev) => prev.map((x) => (x.id === u.id ? { ...x, pinDefini: false, verrouilleJusqua: null } : x)))
  }

  const viderParticipants = async () => {
    const n = utilisateurs.filter((u) => u.role !== 'ADMIN').length
    const ok = await confirmer({
      titre: `Supprimer les ${n} participants ?`,
      message:
        'Tous les agents, managers et clients externes seront supprimés, avec leurs notes, affectations et scores. Les comptes administrateurs sont conservés. Cette action est irréversible.',
      confirmer: 'Tout supprimer',
      danger: true,
      saisieRequise: 'SUPPRIMER',
    })
    if (!ok) return
    const res = await fetch('/api/admin/utilisateurs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'SUPPRIMER' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(data.error || 'La suppression a échoué.')
    toast.success(`${data.count} participants supprimés.`)
    charger()
  }

  const FILTRES: { id: Filtre; label: string }[] = [
    { id: 'tous', label: 'Tous' },
    { id: 'sans_pin', label: 'PIN à définir' },
    { id: 'verrouilles', label: 'Verrouillés' },
    { id: 'managers', label: 'Managers' },
    { id: 'externes', label: 'Clients externes' },
  ]

  return (
    <>
      <AdminHeader
        title="Agents"
        subtitle={`${internes.length} agents et managers · ${compteurs.externes} clients externes`}
        actions={
          <>
            <button onClick={viderParticipants} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4" aria-hidden />
              Vider
            </button>
            <button
              onClick={() => setImportOuvert(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" aria-hidden />
              Importer
            </button>
            <Link
              href="/admin/utilisateurs/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nouvel agent
            </Link>
          </>
        }
      />

      <main className="mx-auto w-full max-w-7xl space-y-5 px-5 py-6 sm:px-8 sm:py-8">
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-card md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-700">
              <QrCode className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-navy-900">QR code unique pour les clients externes</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Les clients notent les agents dont la colonne « QR » est activée ({internes.filter((u) => u.qrcodeActif).length} actuellement).
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={activerTousQr}
              disabled={activationQr}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {activationQr && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Activer pour tous
            </button>
            <button
              onClick={() => setQrOuvert(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-3.5 text-sm font-semibold text-white hover:bg-navy-800"
            >
              Afficher le QR code
            </button>
          </div>
        </section>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrer les agents">
            {FILTRES.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filtre === f.id}
                onClick={() => setFiltre(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  filtre === f.id ? 'bg-navy-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${filtre === f.id ? 'text-navy-200' : 'text-slate-400'}`}>{compteurs[f.id]}</span>
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:w-80">
            <span className="sr-only">Rechercher</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, matricule, emploi, service…"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15"
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Agent</th>
                  <th scope="col" className="px-5 py-3 font-medium">Emploi · service</th>
                  <th scope="col" className="px-5 py-3 font-medium">Rôle</th>
                  <th scope="col" className="px-5 py-3 font-medium">Accès</th>
                  <th scope="col" className="px-5 py-3 text-center font-medium">QR</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && utilisateurs.length === 0
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-5 py-4">
                          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : liste.map((u) => {
                      const role = ROLES[u.role] ?? ROLES.UTILISATEUR
                      const interne = u.role === 'UTILISATEUR' || u.role === 'MANAGER'
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3.5">
                            <Link href={`/admin/utilisateurs/${u.id}`} className="font-medium text-slate-900 hover:text-navy-700 hover:underline">
                              {u.nom} {u.prenom}
                            </Link>
                            <p className="text-xs text-slate-500 tabular-nums">{u.matricule}</p>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">
                            {u.emploi || u.service || '—'}
                            {u.emploi && u.service && <p className="text-xs text-slate-400">{u.service}</p>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${role.className}`}>{role.label}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {estVerrouille(u) ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                                <Lock className="h-3.5 w-3.5" aria-hidden /> Verrouillé
                              </span>
                            ) : u.role === 'EXTERNE' ? (
                              <span className="text-xs text-slate-400">Par téléphone</span>
                            ) : u.pinDefini ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                                <Check className="h-3.5 w-3.5" aria-hidden /> {u.role === 'ADMIN' ? 'Mot de passe' : 'PIN défini'}
                              </span>
                            ) : (
                              <span className="text-xs text-gold-800">PIN à définir</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {interne ? (
                              <label className="inline-flex cursor-pointer items-center justify-center">
                                <span className="sr-only">Notation QR pour {u.prenom} {u.nom}</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(u.qrcodeActif)}
                                  disabled={qrEnCours === u.id}
                                  onChange={() => basculerQr(u)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                              </label>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              {interne && (u.pinDefini || estVerrouille(u)) && (
                                <button
                                  onClick={() => reinitialiserPin(u)}
                                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                  title="Réinitialiser le PIN"
                                >
                                  <KeyRound className="h-3.5 w-3.5" aria-hidden />
                                  <span className="hidden xl:inline">Réinitialiser le PIN</span>
                                </button>
                              )}
                              <Link
                                href={`/admin/utilisateurs/${u.id}`}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700"
                                aria-label={`Fiche de ${u.prenom} ${u.nom}`}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                {!loading && liste.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                      {utilisateurs.length === 0 ? 'Aucun agent. Importez un fichier Excel ou créez un agent.' : 'Aucun agent ne correspond à ces critères.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {importOuvert && <DialogueImport onClose={() => setImportOuvert(false)} onImported={charger} />}
      {qrOuvert && <DialogueQr onClose={() => setQrOuvert(false)} nbAgents={internes.filter((u) => u.qrcodeActif).length} />}
    </>
  )
}

/* ─── Dialogues ─────────────────────────────────────────────────── */

function Dialogue({ titre, onClose, children, className = '' }: { titre: string; onClose: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={titre}
      className={`m-auto w-[calc(100%-2rem)] max-w-md animate-rise-in rounded-2xl bg-white p-0 shadow-overlay backdrop:bg-navy-950/45 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 print:hidden">
        <h2 className="text-base font-semibold text-navy-900">{titre}</h2>
        <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer">
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}

function DialogueImport({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [resultat, setResultat] = useState<{ ok: boolean; message: string; erreurs?: string[] } | null>(null)

  const importer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setEnvoi(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/admin/utilisateurs/import', { method: 'POST', body: fd })
      const data = await res.json()
      setResultat({ ok: res.ok && data.success, message: data.message || data.error, erreurs: data.erreurs })
      if (res.ok) onImported()
    } catch {
      setResultat({ ok: false, message: 'L’envoi du fichier a échoué.' })
    } finally {
      setEnvoi(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Dialogue titre="Importer des participants" onClose={onClose}>
      {resultat ? (
        <div className="space-y-4">
          <p className={`rounded-lg px-4 py-3 text-sm ${resultat.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{resultat.message}</p>
          {resultat.erreurs && resultat.erreurs.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
              {resultat.erreurs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <button onClick={onClose} className="w-full rounded-lg bg-navy-900 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">
            Fermer
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Fichier Excel (.xlsx) avec les colonnes : Matricule, Nom, Prénom, Sexe, Nationalité, Emploi, Service, Département, Direction.
            Les agents existants sont mis à jour par matricule (une cellule vide ne change rien) ; les nouveaux choisiront leur PIN
            à leur première connexion. Le rôle n’est pas modifié, et aucun agent n’est supprimé.
          </p>
          <button
            onClick={() => input.current?.click()}
            disabled={envoi}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-sm text-slate-600 transition-colors hover:border-navy-300 hover:bg-navy-50/40 disabled:opacity-60"
          >
            {envoi ? <Loader2 className="h-6 w-6 animate-spin text-navy-700" aria-hidden /> : <Upload className="h-6 w-6 text-navy-700" aria-hidden />}
            {envoi ? 'Import en cours…' : 'Choisir le fichier'}
          </button>
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" onChange={importer} className="hidden" />
          <a href="/templates/modele-import-agents.xlsx" download className="block text-center text-sm font-medium text-navy-700 hover:underline">
            Télécharger le modèle Excel
          </a>
        </div>
      )}
    </Dialogue>
  )
}

function DialogueQr({ onClose, nbAgents }: { onClose: () => void; nbAgents: number }) {
  const [copie, setCopie] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/qr` : '/qr'
  return (
    <Dialogue titre="QR code clients" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <p className="text-lg font-semibold text-navy-900">Votre avis sur nos agents</p>
        <p className="mt-1 text-sm text-slate-600">Scannez ce code pour évaluer les agents qui vous ont accompagné.</p>
        <div className="mt-5 rounded-xl p-4 ring-1 ring-slate-200">
          <QRCode value={url} size={200} level="M" fgColor="#002B49" />
        </div>
        <p className="mt-2 text-xs text-slate-500 tabular-nums">{url.replace(/^https?:\/\//, '')}</p>
        <p className="mt-4 text-xs text-slate-500 print:hidden">{nbAgents} agents sont actuellement ouverts à la notation client.</p>
        <div className="mt-5 flex w-full gap-2 print:hidden">
          <button
            onClick={() => {
              navigator.clipboard.writeText(url)
              setCopie(true)
              setTimeout(() => setCopie(false), 2000)
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            {copie ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copie ? 'Lien copié' : 'Copier le lien'}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-navy-900 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Imprimer
          </button>
          <a href="/qr" target="_blank" rel="noreferrer" className="rounded-lg p-2.5 text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50" aria-label="Ouvrir la page client">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </Dialogue>
  )
}
