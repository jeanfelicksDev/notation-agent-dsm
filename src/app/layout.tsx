import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, Source_Serif_4 } from 'next/font/google'
import { Toaster } from '@/components/ui/feedback'
import './globals.css'

/** Sans institutionnelle : lettres bien distinctes (Il1, 0O) et chiffres nets pour les scores. */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-plex-sans',
  display: 'swap',
})

/** Serif chaleureuse à tailles optiques, réservée aux titres d'affichage. */
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--font-serif-titres',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'DSM TAMIS — Évaluation des agents',
    template: '%s · DSM TAMIS',
  },
  description: 'Plateforme interne d’évaluation de la performance des agents de la Direction des Solutions Maritimes.',
}

export const viewport: Viewport = {
  themeColor: '#002B49',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${plexSans.variable} ${sourceSerif.variable} h-full`}>
      <body className="min-h-full bg-canvas text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
