import Link from 'next/link'
import { ArrowRight, CalendarClock, KeyRound, Lock, Trophy, UserX } from 'lucide-react'
import prisma from '@/lib/prisma'
import AdminHeader from '@/components/AdminHeader'
import { getCampagneOuverte } from '@/lib/campagne'

export const dynamic = 'force-dynamic'

const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function AdminDashboard() {
  const campagne = await getCampagneOuverte()
  const maintenant = new Date()

  const [agents, campagnes, sansPin, verrouilles, avancement, sansEvaluateur, avisClients] = await Promise.all([
    prisma.utilisateur.count({ where: { role: { in: ['UTILISATEUR', 'MANAGER'] } } }),
    prisma.campagne.count(),
    prisma.utilisateur.count({
      where: { role: { in: ['UTILISATEUR', 'MANAGER'] }, NOT: [{ motDePasse: { startsWith: 'scrypt:' } }] },
    }),
    prisma.utilisateur.count({ where: { verrouilleJusqua: { gt: maintenant } } }),
    campagne
      ? prisma.affectation.groupBy({
          by: ['statut'],
          where: { campagneId: campagne.id, evaluateur: { role: { not: 'EXTERNE' } } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    campagne
      ? prisma.utilisateur.count({
          where: { role: 'UTILISATEUR', affectationsRecues: { none: { campagneId: campagne.id } } },
        })
      : Promise.resolve(0),
    campagne
      ? prisma.noteClient.findMany({ where: { campagneId: campagne.id }, distinct: ['clientId', 'agentId'], select: { id: true } })
      : Promise.resolve([]),
  ])

  const compte = (s: string) => avancement.find((a) => a.statut === s)?._count._all ?? 0
  const total = avancement.reduce((n, a) => n + a._count._all, 0)
  const soumises = compte('TERMINEE')
  const brouillons = compte('BROUILLON')
  const taux = total ? Math.round((soumises / total) * 100) : 0
  const joursRestants = campagne
    ? Math.max(0, Math.ceil((new Date(campagne.dateFin).setHours(23, 59, 59) - maintenant.getTime()) / 86_400_000))
    : 0

  const alertes = [
    sansPin > 0 && {
      icon: KeyRound,
      texte: `${sansPin} agent${sansPin > 1 ? 's n’ont' : ' n’a'} pas encore choisi de PIN`,
      detail: 'Ils le définiront à leur première connexion.',
      href: '/admin/utilisateurs?filtre=sans_pin',
    },
    verrouilles > 0 && {
      icon: Lock,
      texte: `${verrouilles} compte${verrouilles > 1 ? 's' : ''} verrouillé${verrouilles > 1 ? 's' : ''} temporairement`,
      detail: 'Après 5 PIN erronés, pour 15 minutes.',
      href: '/admin/utilisateurs?filtre=verrouilles',
    },
    sansEvaluateur > 0 && {
      icon: UserX,
      texte: `${sansEvaluateur} agent${sansEvaluateur > 1 ? 's' : ''} sans aucun évaluateur`,
      detail: 'Ils n’auront pas de score pour cette campagne.',
      href: campagne ? `/admin/campagnes/${campagne.id}?onglet=affectations` : '/admin/campagnes',
    },
  ].filter(Boolean) as { icon: typeof KeyRound; texte: string; detail: string; href: string }[]

  return (
    <>
      <AdminHeader title="Tableau de bord" subtitle={fmt(maintenant)} />

      <main className="mx-auto w-full max-w-7xl space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        {campagne ? (
          <section className="rounded-[var(--radius-card)] bg-white p-6 shadow-card sm:p-8" aria-labelledby="campagne-titre">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  Campagne ouverte
                </p>
                <h2 id="campagne-titre" className="mt-2 text-2xl font-semibold tracking-tight text-navy-900">
                  {campagne.libelle}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                  <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden />
                  Du {fmt(campagne.dateDebut)} au {fmt(campagne.dateFin)}
                  <span className="text-slate-400">·</span>
                  <strong className="font-medium text-slate-800">
                    {joursRestants === 0 ? 'dernier jour' : `${joursRestants} jour${joursRestants > 1 ? 's' : ''} restant${joursRestants > 1 ? 's' : ''}`}
                  </strong>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/campagnes/${campagne.id}?onglet=suivi`}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
                >
                  Suivre l’avancement
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href={`/admin/classement?campagneId=${campagne.id}`}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  <Trophy className="h-4 w-4 text-gold-600" aria-hidden />
                  Classement provisoire
                </Link>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium text-slate-700">Évaluations internes soumises</p>
                <p className="text-sm text-slate-600 tabular-nums">
                  <strong className="text-2xl font-semibold text-navy-900">{taux} %</strong>
                  <span className="ml-2">
                    {soumises} / {total}
                  </span>
                </p>
              </div>
              <div
                className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${soumises} soumises, ${brouillons} en brouillon, ${total - soumises - brouillons} non commencées`}
              >
                <div className="bg-navy-800" style={{ width: `${total ? (soumises / total) * 100 : 0}%` }} />
                <div className="bg-gold-400" style={{ width: `${total ? (brouillons / total) * 100 : 0}%` }} />
              </div>
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <Legende couleur="bg-navy-800" label="Soumises" valeur={soumises} />
                <Legende couleur="bg-gold-400" label="En brouillon" valeur={brouillons} />
                <Legende couleur="bg-slate-200" label="Non commencées" valeur={total - soumises - brouillons} />
                <Legende couleur="bg-teal-500" label="Avis clients (QR)" valeur={avisClients.length} />
              </dl>
            </div>
          </section>
        ) : (
          <section className="rounded-[var(--radius-card)] bg-white p-8 shadow-card">
            <h2 className="text-lg font-semibold text-navy-900">Aucune campagne ouverte</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Les agents ne peuvent pas noter tant qu’aucune campagne n’est ouverte. Créez-en une, ou rouvrez une campagne existante.
            </p>
            <Link
              href="/admin/campagnes/new"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
            >
              Créer une campagne
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section className="rounded-[var(--radius-card)] bg-white shadow-card" aria-labelledby="alertes-titre">
            <h2 id="alertes-titre" className="border-b border-slate-100 px-6 py-4 text-base font-semibold text-navy-900">
              À surveiller
            </h2>
            {alertes.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">Rien à signaler : tous les comptes sont actifs et chaque agent a des évaluateurs.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alertes.map((a) => (
                  <li key={a.texte}>
                    <Link href={a.href} className="group flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700">
                        <a.icon className="h-4.5 w-4.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{a.texte}</span>
                        <span className="block text-sm text-slate-500">{a.detail}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-navy-700" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[var(--radius-card)] bg-white shadow-card" aria-label="Référentiel">
            <ul className="divide-y divide-slate-100 text-sm">
              {[
                { label: 'Agents et managers', valeur: agents, href: '/admin/utilisateurs' },
                { label: 'Campagnes', valeur: campagnes, href: '/admin/campagnes' },
              ].map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50">
                    <span className="text-slate-700">{r.label}</span>
                    <span className="font-semibold text-navy-900 tabular-nums">{r.valeur}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  )
}

function Legende({ couleur, label, valeur }: { couleur: string; label: string; valeur: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${couleur}`} aria-hidden />
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-semibold text-slate-900 tabular-nums">{valeur}</dd>
    </div>
  )
}
