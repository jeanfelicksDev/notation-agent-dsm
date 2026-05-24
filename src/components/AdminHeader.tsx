'use client'

import { Search, Bell } from 'lucide-react'

interface AdminHeaderProps {
  title?: string
}

export default function AdminHeader({ title }: AdminHeaderProps) {
  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 w-full">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {title ? (
            <h1 className="font-display font-bold text-xl text-slate-800">{title}</h1>
          ) : (
            <div className="relative max-w-md w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="h-8 w-8 rounded-full premium-gradient shadow-sm flex items-center justify-center text-white font-bold text-xs">
            AD
          </div>
        </div>
      </div>
    </header>
  )
}
