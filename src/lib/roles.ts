/** Page d'accueil d'un utilisateur selon son rôle (utilisable côté client). */
export function destinationPourRole(role: string): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'EXTERNE') return '/qr'
  return '/evaluer'
}
