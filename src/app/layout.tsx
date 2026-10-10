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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Merriweather:wght@300;400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full font-sans bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900" style={{ fontFamily: '"Inter", sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
