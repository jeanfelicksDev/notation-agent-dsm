'use client'

import { Bell, Search, ChevronDown } from 'lucide-react'

interface AdminHeaderProps {
  title?: string
  subtitle?: string
}

export default function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 h-16"
      style={{
        background: 'rgba(249,249,249,0.90)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      {/* Left — Page title or Search */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {title ? (
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-none truncate" style={{ color: '#00182f' }}>{title}</h1>
            {subtitle && <p className="text-xs mt-0.5 truncate" style={{ color: '#5a6880' }}>{subtitle}</p>}
          </div>
        ) : (
          <div className="relative max-w-sm w-full hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#adb8c9' }} />
            <input
              type="text"
              placeholder="Rechercher un agent, une campagne…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none transition-all"
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                color: '#0f1923',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#075fac'
                e.target.style.boxShadow = '0 0 0 3px rgba(7,95,172,0.10)'
              }}
              onBlur={e => {
                e.target.style.borderColor = '#e2e8f0'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: '#5a6880' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f3f5f8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Bell className="w-5 h-5" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
            style={{ background: '#ba1a1a', borderColor: 'rgba(249,249,249,0.9)' }}
          />
        </button>

        {/* Admin Avatar */}
        <button
          className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg transition-colors"
          style={{ border: '1.5px solid #e2e8f0', background: 'white' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'white')}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #002d50, #075fac)' }}
          >
            AD
          </div>
          <span className="text-sm font-semibold hidden sm:block" style={{ color: '#00182f' }}>Administrateur</span>
          <ChevronDown className="w-3.5 h-3.5" style={{ color: '#adb8c9' }} />
        </button>
      </div>
    </header>
  )
}
