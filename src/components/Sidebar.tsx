'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Building2, ClipboardList, Trophy, LayoutDashboard, ArrowRight } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { label: 'Tableau de bord', href: '/admin', icon: LayoutDashboard },
    { label: 'Utilisateurs', href: '/admin/utilisateurs', icon: Users },
    { label: 'Sites', href: '/admin/sites', icon: Building2 },
    { label: 'Campagnes', href: '/admin/campagnes', icon: ClipboardList },
  ]

  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 premium-gradient rounded-lg flex items-center justify-center shadow-lg shadow-brand-200">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">DSM Premium</span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all group ${
                  isActive
                    ? 'bg-brand-50 text-brand-600 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-brand-600' : 'group-hover:text-brand-500'}`} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="mt-auto p-6 border-t border-slate-100">
        <Link href="/" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowRight className="w-5 h-5 rotate-180" />
          Retour au portail
        </Link>
      </div>
    </aside>
  )
}
