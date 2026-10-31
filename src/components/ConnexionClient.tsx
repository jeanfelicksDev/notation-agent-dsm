import { Mail, Phone, TriangleAlert } from 'lucide-react'
import { identifiantExige } from '@/lib/identifiant-client'

/** Fiche d'un client externe : identifiant qu'il saisira pour noter (le téléphone prime sur l'e-mail). */
export default function ConnexionClient({ telephone, email }: { telephone: string; email: string }) {
  const exige = identifiantExige({ telephone, email })

  if (exige === null) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
        <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
        Ce client ne pourra pas se connecter : renseignez son téléphone ou une adresse e-mail réelle.
      </p>
    )
  }

  const Icone = exige === 'telephone' ? Phone : Mail
  return (
    <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200">
      <Icone className="mt-px h-4 w-4 shrink-0" aria-hidden />
      {exige === 'telephone'
        ? 'Connexion du client avec son numéro de téléphone (il prime sur l’adresse e-mail).'
        : 'Connexion du client avec son adresse e-mail (aucun téléphone enregistré).'}
    </p>
  )
}
