/** Libellé lisible : les mots en capitales passent en casse de titre, les sigles courts (DSM) restent en capitales. */
export function libelleCampagne(libelle: string) {
  return libelle
    .split(/\s+/)
    .map((m) => (m.length > 3 && m === m.toUpperCase() ? m.charAt(0) + m.slice(1).toLowerCase() : m))
    .join(' ')
}
