'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Trophy,
  Medal,
  Award,
  Gift,
  Info,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  X,
  XCircle,
  Eye,
  EyeOff,
  Search,
  Sparkles,
  Building2,
  FolderGit2,
  Users2,
  Globe2,
  Crown,
  CheckCircle2,
  ChevronRight,
  Filter,
  Check,
  ListOrdered,
  Lock,
  Loader2,
  ClipboardList,
} from 'lucide-react'
import { getAppreciationInfo } from '@/lib/default-criteres'

interface ScoreItem {
  utilisateurId: string
  matricule: string
  nom: string
  prenom: string
  direction: string
  departement: string
  service: string
  siteNom: string
  scoreTotal: number
  scoreCollegues: number
  scoreManager: number
  scoreClient: number
  hasCollegues: boolean
  hasManager: boolean
  hasClient: boolean
  rangGlobal: number
  rangDirection: number
  rangDepartement: number
  rangService: number
  isMajorGlobal: boolean
  isMajorDirection: boolean
  isMajorDepartement: boolean
  isMajorService: boolean
  totalInDirection: number
  totalInDepartement: number
  totalInService: number
}

interface CampagneSummary {
  id: string
  libelle: string
  statut: string
  dateDebut: string
  dateFin: string
}

interface CampagneInfo {
  id: string
  libelle: string
  statut: string
  poidsCollegues: number
  poidsManager: number
  prixGlobal: string
  prixDirection: string
  prixDepartement: string
  prixService: string
}

interface ClassementData {
  campagne: CampagneInfo | null
  toutesLesCampagnes?: CampagneSummary[]
  laureats: {
    majorGlobal: ScoreItem | null
    majorsDirection: Array<{ directionNom: string; major: ScoreItem; totalAgents: number }>
    majorsDepartement: Array<{ departementNom: string; directionNom: string; major: ScoreItem; totalAgents: number }>
    majorsService: Array<{ serviceNom: string; departementNom: string; directionNom: string; major: ScoreItem; totalAgents: number }>
  }
  groupesDirection: Array<{ directionNom: string; scores: ScoreItem[]; major: ScoreItem | null }>
  groupesDepartement: Array<{ departementNom: string; directionNom: string; scores: ScoreItem[]; major: ScoreItem | null }>
  groupesService: Array<{ serviceNom: string; departementNom: string; directionNom: string; scores: ScoreItem[]; major: ScoreItem | null }>
  tousLesScores: ScoreItem[]
}

interface DetailedNote {
  critereId: string
  critereLibelle: string
  noteMaximale: number
  valeur: number
  commentaire: string | null
  typeEvaluateur?: string
  typeEvaluateurs?: string[]
}

interface EvaluateurNotes {
  evaluateur: { id: string; nom: string; prenom: string; matricule: string; role: string; service: string | null }
  notes: DetailedNote[]
}

interface ClientNotes {
  clientLabel: string
  notes: DetailedNote[]
}

interface DetailedNotesData {
  campagneLibelle: string
  criteres: Array<{ id: string; libelle: string; noteMaximale: number; typeEvaluateur: string; typeEvaluateurs?: string[] }>
  evaluateursNotes: EvaluateurNotes[]
  clientsNotes: ClientNotes[]
}

type TabType = 'palmares' | 'direction' | 'departement' | 'service' | 'global'

export default function ClassementPage() {
  const router = useRouter()
  const [data, setData] = useState<ClassementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [anonymized, setAnonymized] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('palmares')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDirection, setFilterDirection] = useState<string>('ALL')
  const [filterDepartement, setFilterDepartement] = useState<string>('ALL')
  const [filterService, setFilterService] = useState<string>('ALL')
  const [selectedScore, setSelectedScore] = useState<ScoreItem | null>(null)
  const [selectedCampagneId, setSelectedCampagneId] = useState<string>('')
  const [detailedNotes, setDetailedNotes] = useState<DetailedNotesData | null>(null)
  const [loadingNotes, setLoadingNotes] = useState(false)

  const loadDetailedNotes = useCallback(async (userId: string, campagneId?: string) => {
    setLoadingNotes(true)
    setDetailedNotes(null)
    try {
      const params = campagneId ? `?campagneId=${encodeURIComponent(campagneId)}` : ''
      const res = await fetch(`/api/admin/classement/notes/${encodeURIComponent(userId)}${params}`)
      if (res.ok) {
        const data = await res.json()
        setDetailedNotes(data)
      }
    } catch {
      // Silently fail — modal still shows score summary
    } finally {
      setLoadingNotes(false)
    }
  }, [])

  const handleSelectScore = useCallback((s: ScoreItem) => {
    setSelectedScore(s)
    loadDetailedNotes(s.utilisateurId, selectedCampagneId || undefined)
  }, [loadDetailedNotes, selectedCampagneId])

  const loadScores = async (campagneId?: string) => {
    setLoading(true)
    try {
      const url = campagneId 
        ? `/api/admin/classement?campagneId=${encodeURIComponent(campagneId)}&t=${Date.now()}`
        : `/api/admin/classement?t=${Date.now()}`
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' }
      })
      const resData = await res.json()
      if (resData && !resData.error) {
        setData(resData)
        if (resData.campagne?.id) {
          setSelectedCampagneId(resData.campagne.id)
        }
      }
    } catch (err) {
      console.error('Erreur chargement classement:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initialCampagneId = params.get('campagneId') || undefined
    loadScores(initialCampagneId)
  }, [])

  const handleRecalculate = async () => {
    setCalculating(true)
    try {
      const currentId = selectedCampagneId || data?.campagne?.id
      const res = await fetch('/api/admin/classement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ campagneId: currentId }),
        cache: 'no-store',
      })
      const resData = await res.json()
      if (resData && !resData.error) {
        if (resData.laureats || resData.tousLesScores) {
          setData(resData)
          if (resData.campagne?.id) setSelectedCampagneId(resData.campagne.id)
        } else {
          await loadScores(currentId)
        }
        setToastMessage('Classement et palmarès recalculés et actualisés avec succès !')
        setTimeout(() => setToastMessage(null), 4000)
        router.refresh()
      }
    } catch (e) {
      console.error(e)
      await loadScores(selectedCampagneId || data?.campagne?.id)
    } finally {
      setCalculating(false)
    }
  }

  const exportToExcel = async () => {
    if (!data || data.tousLesScores.length === 0) return
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // 1. Feuille 1: Palmarès & Lauréats
    const laureatsData: any[] = []
    if (data.laureats.majorGlobal) {
      const mg = data.laureats.majorGlobal
      laureatsData.push({
        Niveau: '🏆 SUPER LAURÉAT DIRECTION DSM',
        Entité: mg.direction,
        Matricule: mg.matricule,
        Nom: mg.nom,
        Prénom: mg.prenom,
        'Score Total (%)': mg.scoreTotal,
        'Prime & Dotation': data.campagne?.prixGlobal || '1 500 000 FCFA + Séjour familial & Gala AGL',
      })
    }

    data.laureats.majorsDepartement.forEach((md) => {
      laureatsData.push({
        Niveau: '🎖️ MEILLEUR AGENT DÉPARTEMENT',
        Entité: `${md.departementNom} (${md.directionNom})`,
        Matricule: md.major.matricule,
        Nom: md.major.nom,
        Prénom: md.major.prenom,
        'Score Total (%)': md.major.scoreTotal,
        'Prime & Dotation': data.campagne?.prixDepartement || '1 000 000 FCFA',
      })
    })

    data.laureats.majorsService.forEach((ms) => {
      laureatsData.push({
        Niveau: '🏅 MEILLEUR AGENT DE SERVICE',
        Entité: `${ms.serviceNom} [${ms.departementNom}]`,
        Matricule: ms.major.matricule,
        Nom: ms.major.nom,
        Prénom: ms.major.prenom,
        'Score Total (%)': ms.major.scoreTotal,
        'Prime & Dotation': data.campagne?.prixService || '500 000 FCFA',
      })
    })

    const wsLaureats = XLSX.utils.json_to_sheet(laureatsData)
    XLSX.utils.book_append_sheet(wb, wsLaureats, 'Palmarès des Lauréats')

    // 2. Feuille 2: Classement par Direction
    const dirData: any[] = []
    data.groupesDirection.forEach((g) => {
      g.scores.forEach((s) => {
        const app = getAppreciationInfo(s.scoreTotal)
        dirData.push({
          Direction: g.directionNom,
          'Rang Direction': s.rangDirection,
          'Rang Global': s.rangGlobal,
          Matricule: s.matricule,
          Nom: s.nom,
          Prénom: s.prenom,
          'Score Collègues & Clients (45 pts)': Math.round((s.hasClient && s.hasCollegues ? (s.scoreCollegues * 0.20 + s.scoreClient * 0.25) : (s.hasCollegues ? s.scoreCollegues * 0.45 : s.scoreClient * 0.45)) * 10) / 10,
          'Score Manager (55 pts)': Math.round(s.scoreManager * 0.55 * 10) / 10,
          'Score Total (/100)': s.scoreTotal,
          Appréciation: app.appreciation,
          Titre: s.isMajorDirection ? '🏆 Major Direction' : '',
        })
      })
    })
    const wsDir = XLSX.utils.json_to_sheet(dirData)
    XLSX.utils.book_append_sheet(wb, wsDir, 'Par Direction')

    // 3. Feuille 3: Classement par Département
    const depData: any[] = []
    data.groupesDepartement.forEach((g) => {
      g.scores.forEach((s) => {
        const app = getAppreciationInfo(s.scoreTotal)
        depData.push({
          Département: g.departementNom,
          Direction: g.directionNom,
          'Rang Département': s.rangDepartement,
          'Rang Direction': s.rangDirection,
          Matricule: s.matricule,
          Nom: s.nom,
          Prénom: s.prenom,
          'Score Total (%)': s.scoreTotal,
          Appréciation: app.appreciation,
          Titre: s.isMajorDepartement ? '🎖️ Major Département' : '',
        })
      })
    })
    const wsDep = XLSX.utils.json_to_sheet(depData)
    XLSX.utils.book_append_sheet(wb, wsDep, 'Par Département')

    // 4. Feuille 4: Classement par Service
    const srvData: any[] = []
    data.groupesService.forEach((g) => {
      g.scores.forEach((s) => {
        const app = getAppreciationInfo(s.scoreTotal)
        srvData.push({
          Service: g.serviceNom,
          Département: g.departementNom,
          Direction: g.directionNom,
          'Rang Service': s.rangService,
          'Rang Département': s.rangDepartement,
          Matricule: s.matricule,
          Nom: s.nom,
          Prénom: s.prenom,
          'Score Total (%)': s.scoreTotal,
          Appréciation: app.appreciation,
          Titre: s.isMajorService ? '🏅 Major Service' : '',
        })
      })
    })
    const wsSrv = XLSX.utils.json_to_sheet(srvData)
    XLSX.utils.book_append_sheet(wb, wsSrv, 'Par Service')

    // 5. Feuille 5: Classement Général
    const globalData = data.tousLesScores.map((s) => {
      const app = getAppreciationInfo(s.scoreTotal)
      return {
        'Rang Global': s.rangGlobal,
        'Rang Direction': s.rangDirection,
        'Rang Département': s.rangDepartement,
        'Rang Service': s.rangService,
        Direction: s.direction,
        Département: s.departement,
        Service: s.service,
        Matricule: s.matricule,
        Nom: s.nom,
        Prénom: s.prenom,
        'Score Collègues (/100)': s.scoreCollegues,
        'Score Clients QR (/100)': s.scoreClient,
        'Score Manager (/100)': s.scoreManager,
        'Part Collègues & Clients (45 pts)': Math.round((s.hasClient && s.hasCollegues ? (s.scoreCollegues * 0.20 + s.scoreClient * 0.25) : (s.hasCollegues ? s.scoreCollegues * 0.45 : s.scoreClient * 0.45)) * 10) / 10,
        'Part Manager (55 pts)': Math.round(s.scoreManager * 0.55 * 10) / 10,
        'Score Total (/100)': s.scoreTotal,
        Appréciation: app.appreciation,
        Interprétation: app.interpretation,
      }
    })
    const wsGlobal = XLSX.utils.json_to_sheet(globalData)
    XLSX.utils.book_append_sheet(wb, wsGlobal, 'Classement Global')

    XLSX.writeFile(wb, `Classement_Complet_DSM_TAMIS_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const getMedalIcon = (rang: number) => {
    switch (rang) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-100/90 text-amber-600 flex items-center justify-center shadow-sm font-black text-sm">
            <Trophy className="w-5 h-5 text-amber-500 fill-amber-400" />
          </div>
        )
      case 2:
        return (
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-sm">
            <Medal className="w-5 h-5 text-slate-400 fill-slate-300" />
          </div>
        )
      case 3:
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-sm">
            <Award className="w-5 h-5 text-amber-700 fill-amber-600" />
          </div>
        )
      default:
        return (
          <span className="w-8 h-8 flex items-center justify-center text-slate-500 font-bold text-sm bg-slate-50 rounded-xl border border-slate-100">
            {rang}
          </span>
        )
    }
  }

  const getRowClass = (rang: number) => {
    if (rang === 1) return 'bg-amber-50/50 hover:bg-amber-50/80 border-amber-200 font-semibold'
    if (rang === 2) return 'bg-slate-50/40 hover:bg-slate-50/70'
    if (rang === 3) return 'bg-orange-50/30 hover:bg-orange-50/60'
    return 'hover:bg-slate-50/80'
  }

  // Filtrage global des scores
  const filteredScores = useMemo(() => {
    if (!data) return []
    return data.tousLesScores.filter((s) => {
      const matchesSearch =
        s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.departement.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.direction.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDir = filterDirection === 'ALL' || s.direction === filterDirection
      const matchesDep = filterDepartement === 'ALL' || s.departement === filterDepartement
      const matchesSrv = filterService === 'ALL' || s.service === filterService

      return matchesSearch && matchesDir && matchesDep && matchesSrv
    })
  }, [data, searchQuery, filterDirection, filterDepartement, filterService])

  // Listes déroulantes pour filtres
  const directionList = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.tousLesScores.map((s) => s.direction))).filter(Boolean)
  }, [data])

  const departementList = useMemo(() => {
    if (!data) return []
    let list = data.tousLesScores
    if (filterDirection !== 'ALL') {
      list = list.filter((s) => s.direction === filterDirection)
    }
    return Array.from(new Set(list.map((s) => s.departement))).filter(Boolean)
  }, [data, filterDirection])

  const serviceList = useMemo(() => {
    if (!data) return []
    let list = data.tousLesScores
    if (filterDepartement !== 'ALL') {
      list = list.filter((s) => s.departement === filterDepartement)
    } else if (filterDirection !== 'ALL') {
      list = list.filter((s) => s.direction === filterDirection)
    }
    return Array.from(new Set(list.map((s) => s.service))).filter(Boolean)
  }, [data, filterDirection, filterDepartement])

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mb-4"></div>
        <p className="text-slate-500 font-bold text-sm">Chargement des classements hiérarchiques DSM...</p>
      </div>
    )
  }

  const allScoresCount = data?.tousLesScores.length || 0

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 font-sans">
      {/* Header Sticky */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-[96rem] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-600 hover:text-slate-900 transition-colors p-2 rounded-xl hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">Classements & Palmarès DSM TAMIS</h1>
                <span className="bg-amber-100 text-amber-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wide">
                  Officiel
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Paliers d'Excellence : Direction (1 500 000 F) • Département (1 000 000 F) • Service (500 000 F)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('global')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all ${
                activeTab === 'global'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                  : 'bg-white hover:bg-blue-50 text-blue-900 border border-blue-200'
              }`}
              title="Afficher la liste intégrale du classement de tous les notés"
            >
              <ListOrdered className="w-4 h-4 text-blue-600" />
              <span>Classement des notés ({allScoresCount})</span>
            </button>

            <button
              onClick={() => setAnonymized(!anonymized)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-all"
              title="Activer/Désactiver l'anonymisation des noms"
            >
              {anonymized ? <Eye className="w-4 h-4 text-brand-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
              <span>{anonymized ? 'Noms visibles' : 'Anonymiser'}</span>
            </button>

            <button
              onClick={exportToExcel}
              disabled={allScoresCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter Excel (5 feuilles)</span>
            </button>

            {!(selectedCampagneId || data?.campagne?.id)?.startsWith('ANNUEL_') && (
              <button
                onClick={handleRecalculate}
                disabled={calculating}
                className="flex items-center gap-2 px-4 py-2 bg-[#002B49] hover:bg-[#001D33] text-[#D4AF37] border border-[#D4AF37]/40 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
                <span>{calculating ? 'Calcul en cours...' : 'Recalculer'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {toastMessage && (
        <div className="max-w-[96rem] mx-auto px-6 pt-4 animate-fade-in">
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5 font-bold text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[96rem] mx-auto p-6 space-y-6">
        {/* Sélecteur de Campagne & Statut Actuel */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#002B49] text-[#D4AF37] flex items-center justify-center font-black shadow-md shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Campagne active</span>
                {data?.campagne?.statut === 'OUVERTE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    En cours de notation
                  </span>
                )}
                {data?.campagne?.statut === 'CLOTUREE' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                    <Lock className="w-3 h-3" />
                    Clôturée
                  </span>
                )}
                {data?.campagne?.statut === 'CALCULEE' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Scores calculés
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-[#002B49]">
                {data?.campagne?.libelle || 'Chargement de la campagne...'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {data?.toutesLesCampagnes && data.toutesLesCampagnes.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 hidden sm:inline">Changer de session :</label>
                <select
                  value={selectedCampagneId || data.campagne?.id || ''}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setSelectedCampagneId(nextId)
                    loadScores(nextId)
                  }}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer shadow-sm"
                >
                  {data.toutesLesCampagnes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.libelle} ({c.statut === 'OUVERTE' ? '🟢 En cours' : c.statut === 'CLOTUREE' ? '🔒 Clôturée' : '📊 Calculée'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {data?.campagne?.id && (
              <Link
                href={`/admin/campagnes/${data.campagne.id}`}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Paramètres campagne</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Banner Récompenses Officielles des Lauréats DSM */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-white/10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-yellow-400 font-extrabold text-xs uppercase tracking-widest mb-1.5">
                <Gift className="w-4 h-4" /> Récompenses officielles des lauréats DSM
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Grille des Distinctions & Primes</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-md">
                Les prix récompensent les meilleurs collaborateurs de chaque entité selon l'évaluation TAMIS.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              {/* Carte Service */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-left hover:bg-white/15 transition-all">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <Award className="w-4 h-4 text-emerald-400" /> Meilleur Agent de Service
                </div>
                <div className="text-lg font-black text-white mt-1">500 000 FCFA</div>
                <div className="text-[10px] text-slate-300 mt-0.5">Prime d'Excellence Cellule</div>
              </div>

              {/* Carte Département */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-left hover:bg-white/15 transition-all">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                  <Medal className="w-4 h-4 text-purple-400" /> Meilleur Département
                </div>
                <div className="text-lg font-black text-white mt-1">1 000 000 FCFA</div>
                <div className="text-[10px] text-slate-300 mt-0.5">Certificat de Mérite DSM</div>
              </div>

              {/* Carte Direction */}
              <div className="bg-gradient-to-br from-yellow-500/25 to-amber-500/10 backdrop-blur-md rounded-2xl p-4 border border-yellow-400/40 text-left relative overflow-hidden shadow-lg">
                <div className="flex items-center gap-1.5 text-xs font-black text-yellow-300 uppercase tracking-wide">
                  <Trophy className="w-4 h-4 text-yellow-400" /> Super Lauréat Direction
                </div>
                <div className="text-xl font-black text-yellow-400 mt-1">1 500 000 FCFA</div>
                <div className="text-[10px] text-yellow-200 mt-0.5 font-semibold">
                  + Séjour familial & Gala AGL
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation par Onglets */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('palmares')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
              activeTab === 'palmares'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>Palmarès & Lauréats</span>
            {data && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  activeTab === 'palmares' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                Top
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('direction')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
              activeTab === 'direction'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Par Direction</span>
            {data && data.groupesDirection.length > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  activeTab === 'direction' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {data.groupesDirection.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('departement')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
              activeTab === 'departement'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Par Département</span>
            {data && data.groupesDepartement.length > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  activeTab === 'departement' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {data.groupesDepartement.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('service')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
              activeTab === 'service'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span>Par Service / Cellule</span>
            {data && data.groupesService.length > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  activeTab === 'service' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {data.groupesService.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('global')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
              activeTab === 'global'
                ? 'bg-blue-900 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <ListOrdered className="w-4 h-4 text-amber-400" />
            <span>Classement de l'ensemble des notés</span>
            {allScoresCount > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  activeTab === 'global' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {allScoresCount}
              </span>
            )}
          </button>
        </div>

        {/* Aucun résultat */}
        {allScoresCount === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-12 text-center text-slate-500 border border-slate-200/80">
            <Info className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-bold text-lg text-slate-800">Aucune évaluation enregistrée pour le moment.</p>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Veuillez vérifier que les notes ont été soumises par les collègues, les clients ou le manager, puis cliquez sur <strong>"Recalculer"</strong>.
            </p>
          </div>
        ) : (
          <>
            {/* ============================================================ */}
            {/* ONGLET 1 : PALMARÈS & LAURÉATS                               */}
            {/* ============================================================ */}
            {activeTab === 'palmares' && data && (
              <div className="space-y-8 animate-fade-in">
                {/* Spotlight Super Lauréat Direction DSM */}
                {data.laureats.majorGlobal && (
                  <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/20 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest text-amber-100">
                          <Crown className="w-4 h-4 text-yellow-300" /> Super Lauréat Direction DSM (1er National)
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black">
                          {anonymized ? 'Collaborateur Anonyme' : `${data.laureats.majorGlobal.prenom} ${data.laureats.majorGlobal.nom}`}
                        </h3>
                        <p className="text-sm text-amber-100 font-medium">
                          Matricule : <span className="font-mono font-bold">{data.laureats.majorGlobal.matricule}</span> • Direction :{' '}
                          <strong>{data.laureats.majorGlobal.direction}</strong> • Service : <strong>{data.laureats.majorGlobal.service}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
                        <div className="text-right">
                          <div className="text-xs text-amber-100 font-bold uppercase">Score Global DSM</div>
                          <div className="text-3xl sm:text-4xl font-black text-white">
                            {data.laureats.majorGlobal.scoreTotal.toFixed(1)} %
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedScore(data.laureats.majorGlobal)}
                          className="px-4 py-2.5 bg-white text-slate-900 rounded-xl font-bold text-xs hover:bg-amber-50 shadow-md transition-all active:scale-95"
                        >
                          Fiche Bilan
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-amber-100">
                      <div>🎁 Dotation : 1 500 000 FCFA + Séjour familial & Gala AGL</div>
                      <div className="flex items-center gap-3">
                        <span>Collègues & Clients : {Math.round((data.laureats.majorGlobal.hasClient && data.laureats.majorGlobal.hasCollegues ? data.laureats.majorGlobal.scoreCollegues * 0.20 + data.laureats.majorGlobal.scoreClient * 0.25 : data.laureats.majorGlobal.hasCollegues ? data.laureats.majorGlobal.scoreCollegues * 0.45 : data.laureats.majorGlobal.scoreClient * 0.45) * 10) / 10}/45 pts</span>
                        <span>•</span>
                        <span>Manager : {Math.round(data.laureats.majorGlobal.scoreManager * 0.55 * 10) / 10}/55 pts</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section Meilleurs Agents par Département */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                        <Medal className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Meilleur Agent par Département</h3>
                        <p className="text-xs text-slate-500">Major de chaque département • Prime de 1 000 000 FCFA</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1 rounded-full">
                      {data.laureats.majorsDepartement.length} département{data.laureats.majorsDepartement.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.laureats.majorsDepartement.map((md) => {
                      const app = getAppreciationInfo(md.major.scoreTotal)
                      const displayName = anonymized
                        ? `Agent Anonyme`
                        : `${md.major.prenom} ${md.major.nom}`
                      return (
                        <div
                          key={md.departementNom}
                          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[11px] font-black uppercase text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-lg truncate">
                                📁 {md.departementNom}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {md.totalAgents} agent{md.totalAgents > 1 ? 's' : ''}
                              </span>
                            </div>

                            <div className="flex items-start gap-3 mt-3">
                              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                                🥇
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 text-base truncate">{displayName}</h4>
                                <p className="text-xs text-slate-500 font-mono">{md.major.matricule}</p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-xs text-slate-400 block font-medium">Score Département</span>
                              <span className="text-lg font-black text-purple-700">
                                {md.major.scoreTotal.toFixed(1)} %
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedScore(md.major)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                            >
                              Consulter
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Section Meilleurs Agents par Service / Cellule */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Meilleur Agent par Service & Cellule</h3>
                        <p className="text-xs text-slate-500">Major de chaque cellule de travail • Prime de 500 000 FCFA</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                      {data.laureats.majorsService.length} service{data.laureats.majorsService.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.laureats.majorsService.map((ms) => {
                      const app = getAppreciationInfo(ms.major.scoreTotal)
                      const displayName = anonymized
                        ? `Agent Anonyme`
                        : `${ms.major.prenom} ${ms.major.nom}`
                      return (
                        <div
                          key={ms.serviceNom}
                          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[11px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-lg truncate">
                                👥 {ms.serviceNom}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {ms.totalAgents} agent{ms.totalAgents > 1 ? 's' : ''}
                              </span>
                            </div>

                            <div className="flex items-start gap-3 mt-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                                🥇
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 text-base truncate">{displayName}</h4>
                                <p className="text-xs text-slate-500 font-mono">{ms.major.matricule}</p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-xs text-slate-400 block font-medium">Score Service</span>
                              <span className="text-lg font-black text-emerald-700">
                                {ms.major.scoreTotal.toFixed(1)} %
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedScore(ms.major)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                            >
                              Consulter
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Bouton d'accès direct au classement complet de l'ensemble des notés */}
                <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-yellow-300 flex items-center justify-center font-black text-xl flex-shrink-0">
                      <ListOrdered className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">Classement Complet de l'Ensemble des Notés</h4>
                      <p className="text-xs text-blue-200 mt-0.5">
                        Accédez au tableau exhaustif des {allScoresCount} agents évalués avec leurs rangs et le détail de chaque note (Collègues & Clients 45 pts, Manager 55 pts).
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('global')
                      window.scrollTo({ top: 400, behavior: 'smooth' })
                    }}
                    className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/20 transition-all hover:scale-105 flex items-center gap-2.5 whitespace-nowrap"
                  >
                    <ListOrdered className="w-4 h-4" />
                    <span>Afficher le classement complet ({allScoresCount} notés)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* ONGLET 2 : CLASSEMENT PAR DIRECTION                          */}
            {/* ============================================================ */}
            {activeTab === 'direction' && data && (
              <div className="space-y-6 animate-fade-in">
                {data.groupesDirection.map((groupe) => (
                  <div key={groupe.directionNom} className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div className="bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {groupe.directionNom}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {groupe.scores.length} collaborateur{groupe.scores.length > 1 ? 's' : ''} évalué{groupe.scores.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {groupe.major && (
                        <div className="bg-amber-500/20 border border-amber-400/40 rounded-xl px-4 py-2 flex items-center gap-2.5 text-xs text-amber-200">
                          <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                          <span>
                            Major Direction :{' '}
                            <strong className="text-yellow-300">
                              {anonymized ? 'Agent #1' : `${groupe.major.prenom} ${groupe.major.nom}`}
                            </strong>{' '}
                            ({groupe.major.scoreTotal.toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>

                    <ScoreTable
                      scores={groupe.scores}
                      rankKey="rangDirection"
                      anonymized={anonymized}
                      onSelectScore={handleSelectScore}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ============================================================ */}
            {/* ONGLET 3 : CLASSEMENT PAR DÉPARTEMENT                        */}
            {/* ============================================================ */}
            {activeTab === 'departement' && data && (
              <div className="space-y-6 animate-fade-in">
                {data.groupesDepartement.map((groupe) => (
                  <div key={groupe.departementNom} className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div className="bg-purple-950 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                          <FolderGit2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {groupe.departementNom}
                          </h3>
                          <p className="text-xs text-purple-300">
                            Direction : {groupe.directionNom} • {groupe.scores.length} agent{groupe.scores.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {groupe.major && (
                        <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 flex items-center gap-2.5 text-xs text-purple-200">
                          <Medal className="w-4 h-4 text-purple-300 flex-shrink-0" />
                          <span>
                            Major Département :{' '}
                            <strong className="text-white">
                              {anonymized ? 'Agent #1' : `${groupe.major.prenom} ${groupe.major.nom}`}
                            </strong>{' '}
                            ({groupe.major.scoreTotal.toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>

                    <ScoreTable
                      scores={groupe.scores}
                      rankKey="rangDepartement"
                      anonymized={anonymized}
                      onSelectScore={handleSelectScore}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ============================================================ */}
            {/* ONGLET 4 : CLASSEMENT PAR SERVICE / CELLULE                  */}
            {/* ============================================================ */}
            {activeTab === 'service' && data && (
              <div className="space-y-6 animate-fade-in">
                {data.groupesService.map((groupe) => (
                  <div key={groupe.serviceNom} className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div className="bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                          <Users2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {groupe.serviceNom}
                          </h3>
                          <p className="text-xs text-slate-400">
                            Département : {groupe.departementNom} • {groupe.scores.length} agent{groupe.scores.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {groupe.major && (
                        <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-4 py-2 flex items-center gap-2.5 text-xs text-emerald-200">
                          <Award className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>
                            Major Service :{' '}
                            <strong className="text-emerald-300">
                              {anonymized ? 'Agent #1' : `${groupe.major.prenom} ${groupe.major.nom}`}
                            </strong>{' '}
                            ({groupe.major.scoreTotal.toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>

                    <ScoreTable
                      scores={groupe.scores}
                      rankKey="rangService"
                      anonymized={anonymized}
                      onSelectScore={handleSelectScore}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ============================================================ */}
            {/* ONGLET 5 : CLASSEMENT GÉNÉRAL ET FILTRES                     */}
            {/* ============================================================ */}
            {activeTab === 'global' && data && (
              <div className="space-y-6 animate-fade-in">
                {/* Barre de Recherche et Filtres */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Rechercher par nom, prénom, matricule, service..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-brand-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    {directionList.length > 1 && (
                      <select
                        value={filterDirection}
                        onChange={(e) => {
                          setFilterDirection(e.target.value)
                          setFilterDepartement('ALL')
                          setFilterService('ALL')
                        }}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="ALL">Toutes les Directions</option>
                        {directionList.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    )}

                    {departementList.length > 1 && (
                      <select
                        value={filterDepartement}
                        onChange={(e) => {
                          setFilterDepartement(e.target.value)
                          setFilterService('ALL')
                        }}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="ALL">Tous les Départements</option>
                        {departementList.map((dep) => (
                          <option key={dep} value={dep}>
                            {dep}
                          </option>
                        ))}
                      </select>
                    )}

                    {serviceList.length > 1 && (
                      <select
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="ALL">Tous les Services</option>
                        {serviceList.map((srv) => (
                          <option key={srv} value={srv}>
                            {srv}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
                  <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <ListOrdered className="w-5 h-5 text-amber-400" />
                      <span>Classement de l'Ensemble des Notés</span>
                    </h3>
                    <span className="text-xs text-slate-300 font-semibold bg-slate-800 px-3 py-1 rounded-full">
                      {filteredScores.length} noté{filteredScores.length > 1 ? 's' : ''} sur {allScoresCount}
                    </span>
                  </div>

                  <ScoreTable
                    scores={filteredScores}
                    rankKey="rangGlobal"
                    showStructureTags
                    anonymized={anonymized}
                    onSelectScore={handleSelectScore}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODALE FICHE BILAN INDIVIDUELLE */}
      {selectedScore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-xs font-extrabold uppercase text-brand-600 tracking-wider">
                  Bilan Individuel d'Évaluation TAMIS
                </span>
                <h2 className="text-2xl font-black text-slate-900">
                  {anonymized ? 'Collaborateur Anonyme' : `${selectedScore.prenom} ${selectedScore.nom}`}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Matricule : {selectedScore.matricule} • Direction : {selectedScore.direction}
                </p>
              </div>
              <button
                onClick={() => setSelectedScore(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rangs Hiérarchiques (Direction, Département, Service) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Rang Direction */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 text-center">
                <div className="text-[11px] font-bold text-blue-800 uppercase">Direction</div>
                <div className="text-xl font-black text-blue-950 mt-1">
                  {selectedScore.rangDirection === 1 ? '🥇 1er' : `${selectedScore.rangDirection}ème`}
                  <span className="text-xs text-blue-600 font-normal"> / {selectedScore.totalInDirection}</span>
                </div>
                {selectedScore.isMajorDirection && (
                  <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                    🏆 Major Direction
                  </span>
                )}
              </div>

              {/* Rang Département */}
              <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-3.5 text-center">
                <div className="text-[11px] font-bold text-purple-800 uppercase">Département</div>
                <div className="text-xl font-black text-purple-950 mt-1">
                  {selectedScore.rangDepartement === 1 ? '🥇 1er' : `${selectedScore.rangDepartement}ème`}
                  <span className="text-xs text-purple-600 font-normal"> / {selectedScore.totalInDepartement}</span>
                </div>
                {selectedScore.isMajorDepartement && (
                  <span className="text-[10px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                    🎖️ Major Département
                  </span>
                )}
              </div>

              {/* Rang Service */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 text-center">
                <div className="text-[11px] font-bold text-emerald-800 uppercase">Service / Cellule</div>
                <div className="text-xl font-black text-emerald-950 mt-1">
                  {selectedScore.rangService === 1 ? '🥇 1er' : `${selectedScore.rangService}ème`}
                  <span className="text-xs text-emerald-600 font-normal"> / {selectedScore.totalInService}</span>
                </div>
                {selectedScore.isMajorService && (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                    🏅 Major Service
                  </span>
                )}
              </div>
            </div>

            {/* Score Global Card */}
            {(() => {
              const app = getAppreciationInfo(selectedScore.scoreTotal)
              const hasColl = selectedScore.hasCollegues
              const hasCli = selectedScore.hasClient
              const clientVal = selectedScore.scoreClient !== undefined ? selectedScore.scoreClient : 0

              // Règle DSM TAMIS : Collègues + Client Interne + Client QR sur 45 pts, Manager sur 55 pts
              const partCollegues = hasColl && hasCli
                ? Math.round(selectedScore.scoreCollegues * 0.20 * 10) / 10
                : hasColl
                ? Math.round(selectedScore.scoreCollegues * 0.45 * 10) / 10
                : 0
              const maxCollegues = hasColl && hasCli ? 20 : 45

              const partClients = hasColl && hasCli
                ? Math.round(clientVal * 0.25 * 10) / 10
                : hasCli
                ? Math.round(clientVal * 0.45 * 10) / 10
                : 0
              const maxClients = hasColl && hasCli ? 25 : 45

              const partNonManager = Math.round(
                (hasColl && hasCli
                  ? partCollegues + partClients
                  : hasColl
                  ? partCollegues
                  : partClients) * 10
              ) / 10

              const partManager = Math.round(selectedScore.scoreManager * 0.55 * 10) / 10

              return (
                <>
                  <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-6 space-y-4 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-300 uppercase font-bold">Rang Global National</div>
                        <div className="text-3xl font-black text-yellow-400">
                          {selectedScore.rangGlobal === 1
                            ? '🥇 1er Global'
                            : selectedScore.rangGlobal === 2
                            ? '🥈 2ème'
                            : selectedScore.rangGlobal === 3
                            ? '🥉 3ème'
                            : `${selectedScore.rangGlobal}ème`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-300 uppercase font-bold">Score Global TAMIS</div>
                        <div className="text-4xl font-black text-white">
                          {selectedScore.scoreTotal.toFixed(1)} <span className="text-lg text-blue-300">/ 100</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${app.colorBadge}`}>
                          {app.appreciation}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">{app.interpretation}</div>
                    </div>
                  </div>

                  {/* Détails des Composantes */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black uppercase text-slate-400 tracking-wider">
                        Répartition des composantes d'évaluation
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        Collègues & Clients ({partNonManager} / 45 pts) • Manager ({partManager} / 55 pts)
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Collègues */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-slate-500 uppercase">Collègues & Pairs ({maxCollegues} pts)</div>
                          <div className="text-xl font-black text-slate-900 mt-1">
                            {partCollegues} <span className="text-xs font-medium text-slate-500">/ {maxCollegues} pts</span>
                          </div>
                          <div className="text-[11px] text-blue-600 font-semibold mt-0.5">
                            Note : {selectedScore.scoreCollegues.toFixed(1)}%
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${maxCollegues > 0 ? Math.min(100, (partCollegues / maxCollegues) * 100) : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Clients Externes */}
                      <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/80 flex flex-col justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-amber-800 uppercase">Clients QR ({hasCli ? `${maxClients} pts` : 'Non noté'})</div>
                          <div className="text-xl font-black text-amber-900 mt-1">
                            {hasCli ? (
                              <>
                                {partClients} <span className="text-xs font-medium text-amber-700">/ {maxClients} pts</span>
                              </>
                            ) : (
                              <span className="text-sm font-semibold text-slate-400">Non concerné</span>
                            )}
                          </div>
                          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                            {hasCli ? `Note : ${clientVal.toFixed(1)}%` : 'Pondéré sur collègues'}
                          </div>
                        </div>
                        <div className="w-full bg-amber-200 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full"
                            style={{ width: `${hasCli && maxClients > 0 ? Math.min(100, (partClients / maxClients) * 100) : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Manager */}
                      <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-200/80 flex flex-col justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-indigo-800 uppercase">Manager (55 pts)</div>
                          <div className="text-xl font-black text-indigo-900 mt-1">
                            {partManager} <span className="text-xs font-medium text-indigo-700">/ 55 pts</span>
                          </div>
                          <div className="text-[11px] text-indigo-700 font-semibold mt-0.5">
                            Note : {selectedScore.scoreManager.toFixed(1)}%
                          </div>
                        </div>
                        <div className="w-full bg-indigo-200 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${Math.min(100, (partManager / 55) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}

            {/* Détail des Notes par Évaluateur */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-brand-600" />
                <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider">Détail des notes reçues</h3>
              </div>

              {loadingNotes ? (
                <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-semibold">Chargement des notes…</span>
                </div>
              ) : detailedNotes ? (
                <>
                  {/* Notes Collègues & Clients Internes */}
                  {(() => {
                    const colleguesEvals = detailedNotes.evaluateursNotes.filter(
                      (e) => e.evaluateur.role !== 'MANAGER' && e.evaluateur.role !== 'ADMIN'
                    )
                    const colleguesCriteres = detailedNotes.criteres.filter((c) => {
                      const types = (c as any).typeEvaluateurs && (c as any).typeEvaluateurs.length > 0 ? (c as any).typeEvaluateurs : [c.typeEvaluateur]
                      return types.includes('COLLEGUE') || types.includes('CLIENT_INTERNE') || types.includes('TOUS')
                    })
                    if (colleguesEvals.length === 0) return null
                    return (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl overflow-hidden">
                        <div className="bg-blue-600 px-4 py-2.5 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users2 className="w-4 h-4" />
                            <span>Notes des Collègues & Clients Internes ({colleguesEvals.length} évaluateur{colleguesEvals.length > 1 ? 's' : ''})</span>
                          </div>
                          <span className="text-[11px] font-black bg-white/20 px-2 py-0.5 rounded">Barème normalisé sur 45 pts</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-blue-50 border-b border-blue-100">
                              <tr>
                                <th className="px-3 py-2.5 text-left font-bold text-blue-800 whitespace-nowrap">Évaluateur</th>
                                {colleguesCriteres.map((c) => (
                                  <th key={c.id} className="px-3 py-2.5 text-center font-bold text-blue-800 whitespace-nowrap" title={c.libelle}>
                                    {c.libelle.length > 20 ? c.libelle.slice(0, 18) + '…' : c.libelle}
                                    <div className="text-[10px] font-normal text-blue-500">/{c.noteMaximale}</div>
                                  </th>
                                ))}
                                <th className="px-3 py-2.5 text-center font-bold text-blue-900 whitespace-nowrap">Total Brut</th>
                                <th className="px-3 py-2.5 text-center font-black text-blue-950 whitespace-nowrap bg-blue-100/60">Sur 45 pts</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-50">
                              {colleguesEvals.map((ev) => {
                                const filteredNotes = ev.notes.filter((n) => {
                                  const types = (n as any).typeEvaluateurs && (n as any).typeEvaluateurs.length > 0 ? (n as any).typeEvaluateurs : [n.typeEvaluateur]
                                  return types.includes('COLLEGUE') || types.includes('CLIENT_INTERNE') || types.includes('TOUS')
                                })
                                const total = filteredNotes.reduce((s, n) => s + n.valeur, 0)
                                const maxTotal = filteredNotes.reduce((s, n) => s + n.noteMaximale, 0)
                                const scoreSur45 = maxTotal > 0 ? Math.round((total / maxTotal) * 45 * 10) / 10 : 0
                                return (
                                  <tr key={ev.evaluateur.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      <div className="font-bold text-slate-800">
                                        {anonymized ? 'Évaluateur Anonyme' : `${ev.evaluateur.prenom} ${ev.evaluateur.nom}`}
                                      </div>
                                      <div className="text-[10px] text-slate-400">{anonymized ? 'Service Anonymisé' : (ev.evaluateur.service || '-')}</div>
                                    </td>
                                    {colleguesCriteres.map((c) => {
                                      const note = filteredNotes.find((n) => n.critereId === c.id)
                                      return (
                                        <td key={c.id} className="px-3 py-2.5 text-center">
                                          {note ? (
                                            <span className={`font-bold ${note.valeur >= c.noteMaximale * 0.8 ? 'text-emerald-600' : note.valeur >= c.noteMaximale * 0.5 ? 'text-amber-600' : 'text-red-500'}`}>
                                              {note.valeur}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300">-</span>
                                          )}
                                        </td>
                                      )
                                    })}
                                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                                      {total}<span className="text-slate-400 font-normal">/{maxTotal}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-black text-blue-700 bg-blue-50/80">
                                      {scoreSur45} <span className="text-[10px] text-blue-500 font-normal">/ 45</span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Notes Clients Externes QR */}
                  {detailedNotes.clientsNotes.length > 0 && (() => {
                    const clientCriteres = detailedNotes.criteres.filter((c) => c.typeEvaluateur === 'CLIENT')
                    return (
                      <div className="bg-amber-50/50 border border-amber-100 rounded-2xl overflow-hidden">
                        <div className="bg-amber-500 px-4 py-2.5 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Globe2 className="w-4 h-4" />
                            <span>Notes des Clients Externes QR ({detailedNotes.clientsNotes.length} avis)</span>
                          </div>
                          <span className="text-[11px] font-black bg-white/20 px-2 py-0.5 rounded">Barème normalisé sur 45 pts</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-amber-50 border-b border-amber-100">
                              <tr>
                                <th className="px-3 py-2.5 text-left font-bold text-amber-800 whitespace-nowrap">Client</th>
                                {clientCriteres.map((c) => (
                                  <th key={c.id} className="px-3 py-2.5 text-center font-bold text-amber-800 whitespace-nowrap" title={c.libelle}>
                                    {c.libelle.length > 20 ? c.libelle.slice(0, 18) + '…' : c.libelle}
                                    <div className="text-[10px] font-normal text-amber-500">/{c.noteMaximale}</div>
                                  </th>
                                ))}
                                <th className="px-3 py-2.5 text-center font-bold text-amber-900 whitespace-nowrap">Total Brut</th>
                                <th className="px-3 py-2.5 text-center font-black text-amber-950 whitespace-nowrap bg-amber-100/60">Sur 45 pts</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-50">
                              {detailedNotes.clientsNotes.map((cl, idx) => {
                                const total = cl.notes.reduce((s, n) => s + n.valeur, 0)
                                const maxTotal = cl.notes.reduce((s, n) => s + n.noteMaximale, 0)
                                const scoreSur45 = maxTotal > 0 ? Math.round((total / maxTotal) * 45 * 10) / 10 : 0
                                return (
                                  <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                                    <td className="px-3 py-2.5 whitespace-nowrap font-bold text-slate-800">{cl.clientLabel}</td>
                                    {clientCriteres.map((c) => {
                                      const note = cl.notes.find((n) => n.critereId === c.id)
                                      return (
                                        <td key={c.id} className="px-3 py-2.5 text-center">
                                          {note ? (
                                            <span className={`font-bold ${note.valeur >= c.noteMaximale * 0.8 ? 'text-emerald-600' : note.valeur >= c.noteMaximale * 0.5 ? 'text-amber-600' : 'text-red-500'}`}>
                                              {note.valeur}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300">-</span>
                                          )}
                                        </td>
                                      )
                                    })}
                                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                                      {total}<span className="text-slate-400 font-normal">/{maxTotal}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-black text-amber-800 bg-amber-50/80">
                                      {scoreSur45} <span className="text-[10px] text-amber-600 font-normal">/ 45</span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Notes Manager */}
                  {(() => {
                    const managerEvals = detailedNotes.evaluateursNotes.filter(
                      (e) => e.evaluateur.role === 'MANAGER' || e.evaluateur.role === 'ADMIN' || e.notes.some((n) => n.typeEvaluateur === 'MANAGER')
                    )
                    const managerCriteres = detailedNotes.criteres.filter((c) => {
                      const types = (c as any).typeEvaluateurs && (c as any).typeEvaluateurs.length > 0 ? (c as any).typeEvaluateurs : [c.typeEvaluateur]
                      return types.includes('MANAGER') || types.includes('TOUS')
                    })
                    if (managerEvals.length === 0) return null
                    return (
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl overflow-hidden">
                        <div className="bg-indigo-600 px-4 py-2.5 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4" />
                            <span>Notes du Manager ({managerEvals.length})</span>
                          </div>
                          <span className="text-[11px] font-black bg-white/20 px-2 py-0.5 rounded">Barème normalisé sur 55 pts</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-indigo-50 border-b border-indigo-100">
                              <tr>
                                <th className="px-3 py-2.5 text-left font-bold text-indigo-800 whitespace-nowrap">Manager</th>
                                {managerCriteres.map((c) => (
                                  <th key={c.id} className="px-3 py-2.5 text-center font-bold text-indigo-800 whitespace-nowrap" title={c.libelle}>
                                    {c.libelle.length > 20 ? c.libelle.slice(0, 18) + '…' : c.libelle}
                                    <div className="text-[10px] font-normal text-indigo-500">/{c.noteMaximale}</div>
                                  </th>
                                ))}
                                <th className="px-3 py-2.5 text-center font-bold text-indigo-900 whitespace-nowrap">Total Brut</th>
                                <th className="px-3 py-2.5 text-center font-black text-indigo-950 whitespace-nowrap bg-indigo-100/60">Sur 55 pts</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-indigo-50">
                              {managerEvals.map((ev) => {
                                const managerNotes = ev.notes.filter((n) => {
                                  const types = (n as any).typeEvaluateurs && (n as any).typeEvaluateurs.length > 0 ? (n as any).typeEvaluateurs : [n.typeEvaluateur]
                                  return types.includes('MANAGER') || types.includes('TOUS')
                                })
                                const total = managerNotes.reduce((s, n) => s + n.valeur, 0)
                                const maxTotal = managerNotes.reduce((s, n) => s + n.noteMaximale, 0)
                                const scoreSur55 = maxTotal > 0 ? Math.round((total / maxTotal) * 55 * 10) / 10 : 0
                                return (
                                  <tr key={ev.evaluateur.id} className="hover:bg-indigo-50/50 transition-colors">
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      <div className="font-bold text-slate-800">
                                        {anonymized ? 'Manager Anonyme' : `${ev.evaluateur.prenom} ${ev.evaluateur.nom}`}
                                      </div>
                                      <div className="text-[10px] text-slate-400">{anonymized ? 'Service Anonymisé' : (ev.evaluateur.service || '-')}</div>
                                    </td>
                                    {managerCriteres.map((c) => {
                                      const note = managerNotes.find((n) => n.critereId === c.id)
                                      return (
                                        <td key={c.id} className="px-3 py-2.5 text-center">
                                          {note ? (
                                            <span className={`font-bold ${note.valeur >= c.noteMaximale * 0.8 ? 'text-emerald-600' : note.valeur >= c.noteMaximale * 0.5 ? 'text-amber-600' : 'text-red-500'}`}>
                                              {note.valeur}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300">-</span>
                                          )}
                                        </td>
                                      )
                                    })}
                                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                                      {total}<span className="text-slate-400 font-normal">/{maxTotal}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-black text-indigo-700 bg-indigo-50/80">
                                      {scoreSur55} <span className="text-[10px] text-indigo-500 font-normal">/ 55</span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {detailedNotes.evaluateursNotes.length === 0 && detailedNotes.clientsNotes.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <XCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-semibold">Aucune note individuelle disponible</p>
                    </div>
                  )}
                </>
              ) : (selectedCampagneId || data?.campagne?.id)?.startsWith('ANNUEL_') ? (
                <div className="text-center py-6 text-slate-400 text-sm">
                  Les détails individuels ne sont pas disponibles pour le palmarès annuel (Moyenne globale).
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                  Impossible de charger les notes détaillées
                </div>
              )}
            </div>

            {/* Actions Modal */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer / Exporter PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreTable({
  scores,
  rankKey,
  showStructureTags = false,
  anonymized,
  onSelectScore,
}: {
  scores: ScoreItem[]
  rankKey: 'rangGlobal' | 'rangDirection' | 'rangDepartement' | 'rangService'
  showStructureTags?: boolean
  anonymized: boolean
  onSelectScore: (s: ScoreItem) => void
}) {
  const getMedalIcon = (rang: number) => {
    switch (rang) {
      case 1:
        return (
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs shadow-sm">
            🥇
          </div>
        )
      case 2:
        return (
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-black text-xs">
            🥈
          </div>
        )
      case 3:
        return (
          <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-black text-xs">
            🥉
          </div>
        )
      default:
        return (
          <span className="w-7 h-7 flex items-center justify-center text-slate-500 font-bold text-xs bg-slate-100 rounded-lg">
            {rang}
          </span>
        )
    }
  }

  const getRowClass = (rang: number) => {
    if (rang === 1) return 'bg-amber-50/50 hover:bg-amber-50/80 font-semibold'
    if (rang === 2) return 'bg-slate-50/40 hover:bg-slate-50/70'
    if (rang === 3) return 'bg-orange-50/30 hover:bg-orange-50/60'
    return 'hover:bg-slate-50/80'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 text-xs uppercase font-black tracking-wider">
          <tr>
            <th className="px-4 py-3.5 text-left w-14">Rang</th>
            <th className="px-4 py-3.5 text-left">Matricule</th>
            <th className="px-4 py-3.5 text-left">Collaborateur</th>
            {showStructureTags && <th className="px-4 py-3.5 text-left">Organisation</th>}
            <th className="px-4 py-3.5 text-center">Titres & Distinctions</th>
            <th className="px-4 py-3.5 text-right">Collègues & Pairs</th>
            <th className="px-4 py-3.5 text-right">Clients QR</th>
            <th className="px-4 py-3.5 text-right">Manager (55 pts)</th>
            <th className="px-4 py-3.5 text-right">Score Total</th>
            <th className="px-4 py-3.5 text-left pl-6">Appréciation</th>
            <th className="px-4 py-3.5 text-center">Fiche Bilan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {scores.map((score, idx) => {
            const rang = score[rankKey]
            const app = getAppreciationInfo(score.scoreTotal)
            const displayName = anonymized
              ? `Agent #${idx + 1}`
              : `${score.prenom} ${score.nom}`
            const displayMatricule = anonymized
              ? `***${score.matricule.slice(-2)}`
              : score.matricule

            const hasColl = score.hasCollegues
            const hasCli = score.hasClient
            const clientVal = score.scoreClient !== undefined ? score.scoreClient : 0

            // Règle DSM TAMIS : Collègues + Client Interne + Client QR sur 45 pts, Manager sur 55 pts
            const partCollegues = hasColl && hasCli
              ? Math.round(score.scoreCollegues * 0.20 * 10) / 10
              : hasColl
              ? Math.round(score.scoreCollegues * 0.45 * 10) / 10
              : 0
            const maxCollegues = hasColl && hasCli ? 20 : 45

            const partClients = hasColl && hasCli
              ? Math.round(clientVal * 0.25 * 10) / 10
              : hasCli
              ? Math.round(clientVal * 0.45 * 10) / 10
              : 0
            const maxClients = hasColl && hasCli ? 25 : 45

            const partManager = Math.round(score.scoreManager * 0.55 * 10) / 10

            return (
              <tr
                key={score.utilisateurId}
                className={`transition-colors ${getRowClass(rang)}`}
              >
                <td className="px-4 py-4">{getMedalIcon(rang)}</td>
                <td className="px-4 py-4 font-mono font-bold text-slate-700">
                  {displayMatricule}
                </td>
                <td className="px-4 py-4">
                  <div className="font-bold text-slate-900">{displayName}</div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    {score.service}
                  </div>
                </td>

                {showStructureTags && (
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-slate-700 truncate max-w-[140px]" title={score.direction}>
                        🏢 {score.direction}
                      </span>
                      <span className="text-slate-500 text-[11px] truncate max-w-[140px]" title={score.departement}>
                        📁 {score.departement}
                      </span>
                    </div>
                  </td>
                )}

                <td className="px-4 py-4 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {score.isMajorGlobal && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                        👑 Super Lauréat
                      </span>
                    )}
                    {score.isMajorDirection && !score.isMajorGlobal && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                        🏆 1er Direction
                      </span>
                    )}
                    {score.isMajorDepartement && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                        🎖️ 1er Département
                      </span>
                    )}
                    {score.isMajorService && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        🏅 1er Service
                      </span>
                    )}
                    {!score.isMajorGlobal && !score.isMajorDirection && !score.isMajorDepartement && !score.isMajorService && (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4 text-right">
                  {hasColl ? (
                    <>
                      <span className="font-bold text-slate-800">{partCollegues}</span>
                      <span className="text-slate-500"> / {maxCollegues}</span>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        ({score.scoreCollegues.toFixed(0)}%)
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5" title="Aucune note reçue">
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="text-xs font-semibold text-red-400">Non noté</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  {hasCli ? (
                    <>
                      <span className="font-bold text-slate-800">{partClients}</span>
                      <span className="text-slate-500"> / {maxClients}</span>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        ({clientVal.toFixed(0)}%)
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Non concerné</span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  {score.hasManager ? (
                    <>
                      <span className="font-bold text-slate-800">{partManager}</span>
                      <span className="text-slate-500"> / 55</span>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        ({score.scoreManager.toFixed(0)}%)
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5" title="Aucune note manager reçue">
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="text-xs font-semibold text-red-400">Non noté</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <span
                    className={`text-base font-black ${
                      rang === 1 ? 'text-amber-600' : 'text-blue-600'
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
                    <span className="text-[11px] text-slate-500">{app.interpretation}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => onSelectScore(score)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    Consulter
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}