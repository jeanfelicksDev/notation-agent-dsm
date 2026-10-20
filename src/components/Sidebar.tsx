'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  QrCode,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'

const navItems = [
  { label: 'Tableau de bord', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Campagnes', href: '/admin/campagnes', icon: ClipboardList },
  { label: 'Agents', href: '/admin/utilisateurs', icon: Users },
  { label: 'Listes déroulantes', href: '/admin/listes', icon: ListChecks },
  { label: 'Classement', href: '/admin/classement', icon: Trophy },
]

export default function Sidebar({ admin }: { admin: { prenom: string; nom: string } }) {
  const pathname = usePathname()
  const [ouvert, setOuvert] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <>
      {/* Barre mobile */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-navy-900 px-4 text-white lg:hidden">
        <span className="flex items-center gap-2.5 text-[15px] font-semibold">
          <BrandMark size={28} />
          DSM <span className="text-gold-500">TAMIS</span>
        </span>
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="-mr-2 rounded-md p-2 text-navy-100 hover:bg-white/10"
          aria-label="Ouvrir le menu"
          aria-expanded={ouvert}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {ouvert && (
        <div className="fixed inset-0 z-40 bg-navy-950/50 animate-fade-in lg:hidden" onClick={() => setOuvert(false)} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col bg-navy-900 text-white transition-transform duration-200 ease-out lg:translate-x-0 ${
          ouvert ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation de l'administration"
      >
        <div className="flex h-16 items-center justify-between gap-3 px-5">
          <span className="flex items-center gap-3">
            <BrandMark size={32} />
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold">
                DSM <span className="text-gold-500">TAMIS</span>
              </span>
              <span className="block text-xs text-navy-300">Administration</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            className="rounded-md p-1.5 text-navy-200 hover:bg-white/10 lg:hidden"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-4">
          {navItems.map((item) => {
            const actif = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={actif ? 'page' : undefined}
                onClick={() => setOuvert(false)}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  actif ? 'bg-white/10 font-semibold text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className={`h-4.5 w-4.5 shrink-0 ${actif ? 'text-gold-400' : ''}`} aria-hidden />
                {item.label}
              </Link>
            )
          })}

          <div className="my-4 border-t border-white/10" />

          <a
            href="/qr"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-navy-200 transition-colors hover:bg-white/5 hover:text-white"
          >
            <QrCode className="h-4.5 w-4.5 shrink-0" aria-hidden />
            <span className="flex-1">Portail clients (QR)</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden />
          </a>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-gold-300">
              {admin.prenom.charAt(0)}
              {admin.nom.charAt(0)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-navy-100">
              {admin.prenom} {admin.nom}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md p-1.5 text-navy-300 hover:bg-white/10 hover:text-white"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
