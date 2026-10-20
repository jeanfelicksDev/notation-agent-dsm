import type { Metadata, Viewport } from 'next'
import { Bodoni_Moda, Public_Sans } from 'next/font/google'
import { Toaster } from '@/components/ui/feedback'
import './globals.css'

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
})

/** Didone à fort contraste, réservée aux titres d'affichage (ton « distinction »). */
const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-bodoni',
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
    <html lang="fr" className={`${publicSans.variable} ${bodoniModa.variable} h-full`}>
      <body className="min-h-full bg-canvas text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
