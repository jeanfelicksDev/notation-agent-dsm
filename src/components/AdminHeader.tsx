import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface AdminHeaderProps {
  title?: string
  subtitle?: React.ReactNode
  /** Lien de retour (fil d'Ariane court) */
  back?: { href: string; label: string }
  /** Actions principales de la page, alignées à droite */
  actions?: React.ReactNode
}

export default function AdminHeader({ title, subtitle, back, actions }: AdminHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div className="min-w-0">
          {back && (
            <Link
              href={back.href}
              className="-ml-1 mb-2 inline-flex items-center gap-1 rounded px-1 text-sm text-slate-500 hover:text-navy-800"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {back.label}
            </Link>
          )}
          <h1 className="truncate text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">{title ?? 'Tableau de bord'}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-600">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
