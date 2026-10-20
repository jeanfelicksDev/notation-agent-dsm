import type { Metadata, Viewport } from 'next'
import { Big_Shoulders, Big_Shoulders_Stencil, Public_Sans } from 'next/font/google'
import { Toaster } from '@/components/ui/feedback'
import './globals.css'

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
})

/** Capitales condensées de la signalétique portuaire : titres d'affichage uniquement. */
const bigShoulders = Big_Shoulders({
  subsets: ['latin'],
  variable: '--font-big-shoulders',
  display: 'swap',
})

/** Pochoir des marquages de conteneurs : réservé aux grands chiffres de la page d'accueil. */
const bigShouldersStencil = Big_Shoulders_Stencil({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-bs-stencil',
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
    <html lang="fr" className={`${publicSans.variable} ${bigShoulders.variable} ${bigShouldersStencil.variable} h-full`}>
      <body className="min-h-full bg-canvas text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
