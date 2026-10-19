import { Anchor } from 'lucide-react'

/**
 * Pictogramme de marque (aucun logo officiel n'est fourni : on garde l'ancre déjà en usage).
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[25%] bg-gold-500 text-navy-900"
      style={{ width: size, height: size }}
    >
      <Anchor style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.4} />
    </span>
  )
}
