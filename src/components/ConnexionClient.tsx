import { Mail, Phone, TriangleAlert } from 'lucide-react'
import { identifiantsAcceptes } from '@/lib/identifiant-client'

/** Fiche d'un client externe : identifiant(s) qu'il pourra saisir pour noter. */
export default function ConnexionClient({ telephone, email }: { telephone: string; email: string }) {
  const acceptes = identifiantsAcceptes({ telephone, email })

  if (acceptes.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
        <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
        Ce client ne pourra pas se connecter : renseignez son téléphone ou une adresse e-mail réelle.
      </p>
    )
  }

  const Icone = acceptes[0] === 'telephone' ? Phone : Mail
  return (
    <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200">
      <Icone className="mt-px h-4 w-4 shrink-0" aria-hidden />
      {acceptes.length === 2
        ? 'Connexion du client avec son numéro de téléphone ou son adresse e-mail, à son choix.'
        : acceptes[0] === 'telephone'
        ? 'Connexion du client avec son numéro de téléphone (aucune adresse e-mail réelle enregistrée).'
        : 'Connexion du client avec son adresse e-mail (aucun téléphone enregistré).'}
    </p>
  )
}
