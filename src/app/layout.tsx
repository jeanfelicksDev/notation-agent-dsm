import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSM - Système de Notation & Performance",
  description: "Plateforme ultra-premium de gestion de la performance et de notation des agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`h-full antialiased`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full font-sans bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900" style={{ fontFamily: '"Inter", sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
