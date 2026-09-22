'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Building2,
  ClipboardList,
  Trophy,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  QrCode,
} from 'lucide-react'

const navItems = [
  { label: 'Tableau de bord', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Campagnes', href: '/admin/campagnes', icon: ClipboardList },
  { label: 'Agents & Utilisateurs', href: '/admin/utilisateurs', icon: Users },
  { label: 'Sites', href: '/admin/sites', icon: Building2 },
  { label: 'Classement', href: '/admin/classement', icon: Trophy },
  { label: 'Portail QR Code', href: '/qr', icon: QrCode },
]

export default function Sidebar() {
  const pathname = usePathname()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <aside className="dsm-sidebar">
      {/* Logo */}
      <div className="dsm-sidebar-logo">
        <div className="dsm-sidebar-logo-icon">
          {/* Anchor SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3"/>
            <line x1="12" y1="22" x2="12" y2="8"/>
            <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-base leading-none">DSM <span style={{ color: '#D4AF37' }}>TAMIS</span></p>
          <p className="text-white/40 text-xs mt-0.5 leading-none">Administration</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="dsm-sidebar-nav">
        <p className="dsm-nav-label">Navigation</p>
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dsm-nav-link${isActive ? ' active' : ''}`}
            >
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="dsm-sidebar-footer">
        <Link
          href="/"
          className="dsm-nav-link mb-1"
          style={{ marginLeft: 0, paddingLeft: '0.875rem' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          <span>Portail Notants</span>
        </Link>
        <button
          onClick={handleLogout}
          className="dsm-nav-link w-full text-left"
          style={{ marginLeft: 0, paddingLeft: '0.875rem', color: 'rgba(255,255,255,0.45)' }}
        >
          <LogOut style={{ width: '16px', height: '16px' }} />
          <span>Se déconnecter</span>
        </button>
      </div>
    </aside>
  )
}
