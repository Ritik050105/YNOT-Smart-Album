import { Spread } from '@/types'

/** Bottom to top. Older albums retain image-first, text-on-top stacking. */
export function spreadLayers(spread: Spread) {
  const layers = [
    ...spread.placements.map(value => ({ kind: 'image' as const, id: value.placeholderId, value })),
    ...spread.textBoxes.map(value => ({ kind: 'text' as const, id: value.id, value })),
  ]
  const next = Math.max(-1, ...layers.map(l => l.value.zIndex ?? -1)) + 1
  return layers.map((layer, i) => ({ ...layer, rank: layer.value.zIndex ?? next + i }))
    .sort((a, b) => a.rank - b.rank)
}
