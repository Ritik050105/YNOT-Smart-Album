import { TemplateDefinition, PlaceholderRect } from '@/types'
import { GAP, rect, distributeEvenly, placeGridInRect, orientationFor, geometrySignature } from './templateLayout'

/** Procedurally generates the bulk of the template library (~480 layouts across 1-30 photos,
 *  on top of the ~24 hand-designed ones in templates.ts) — the same approach real album apps
 *  use to reach large template counts, since hand-crafting 500 unique layouts isn't practical.
 *  Every family below is a deterministic parameter sweep (no randomness), so the same layouts
 *  come out on every app run/build and remain stable for saved projects referencing them by id. */

// A tasteful, photography-studio palette (warm metals, deep jewel tones, soft neutrals) used for
// template swatches instead of flat sample colors — cycled deterministically per template so the
// gallery reads as a designed set rather than a random color wash.
const GRADIENTS = [
  'linear-gradient(135deg, #d4a24e, #8a5a1f)', // gold
  'linear-gradient(135deg, #e8d9c0, #b89b6e)', // champagne
  'linear-gradient(135deg, #7a1f3d, #3a0d1d)', // maroon
  'linear-gradient(135deg, #1f6f5c, #0c3a30)', // emerald
  'linear-gradient(135deg, #2b4a63, #13222e)', // navy-teal
  'linear-gradient(135deg, #5e3a6e, #2c1733)', // plum
  'linear-gradient(135deg, #c77b56, #7a3b26)', // terracotta
  'linear-gradient(135deg, #e2a9a1, #a65d58)', // blush
  'linear-gradient(135deg, #3a3a3a, #171717)', // charcoal
  'linear-gradient(135deg, #7c9473, #41513a)', // sage
]
let gradientCursor = 0
function nextGradient(): string {
  const g = GRADIENTS[gradientCursor % GRADIENTS.length]
  gradientCursor++
  return g
}

const MAX_COUNT = 30
const results: TemplateDefinition[] = []
const seenSignatures = new Set<string>()

function addTemplate(id: string, name: string, count: number, placeholders: PlaceholderRect[]) {
  const sig = `${count}:${geometrySignature(placeholders)}`
  if (seenSignatures.has(sig)) return
  seenSignatures.add(sig)
  results.push({
    id,
    name,
    photoCount: count,
    pageSide: 'spread',
    placeholders,
    isBuiltIn: true,
    createdAt: new Date(0).toISOString(),
    thumbnailColor: nextGradient(),
  })
}

/** Mirrors a set of placeholders horizontally (x' = 1 - x - width) — doubles a family's variety
 *  for layouts that aren't already left/right symmetric. */
function mirror(placeholders: PlaceholderRect[]): PlaceholderRect[] {
  return placeholders.map((p) => ({ ...p, x: 1 - p.x - p.width }))
}

// ---------------------------------------------------------------------------
// Family 1: Grid — every valid balanced row-count for a given photo count.
// ---------------------------------------------------------------------------
function genGrids(count: number) {
  const candidates = new Set([1, 2, 3, 4, Math.round(Math.sqrt(count)), count])
  for (const rows of candidates) {
    if (rows < 1 || rows > count) continue
    const placeholders = placeGridInRect(0, count, 0, 0, 1, 1, rows)
    addTemplate(`gen-grid-${count}-${rows}`, `Grid ${rows}×${Math.ceil(count / rows)}`, count, placeholders)
  }
}

// ---------------------------------------------------------------------------
// Family 2: Hero + supporting grid, in four positions and two hero sizes.
// ---------------------------------------------------------------------------
function genHero(count: number) {
  if (count < 2) return
  const positions: Array<'left' | 'right' | 'top' | 'bottom'> = ['left', 'right', 'top', 'bottom']
  const sizes = [0.6]
  for (const pos of positions) {
    for (const size of sizes) {
      const vertical = pos === 'left' || pos === 'right'
      const heroPlaceholder = vertical
        ? rect('p0', pos === 'left' ? GAP / 2 : 1 - size + GAP / 2, GAP / 2, size - GAP, 1 - GAP, 'portrait')
        : rect('p0', GAP / 2, pos === 'top' ? GAP / 2 : 1 - size + GAP / 2, 1 - GAP, size - GAP, 'landscape')
      const restRect = vertical
        ? { x0: pos === 'left' ? size : 0, y0: 0, w: 1 - size, h: 1 }
        : { x0: 0, y0: pos === 'top' ? size : 0, w: 1, h: 1 - size }
      const rest = placeGridInRect(1, count - 1, restRect.x0, restRect.y0, restRect.w, restRect.h)
      const placeholders = [heroPlaceholder, ...rest]
      addTemplate(
        `gen-hero-${count}-${pos}-${Math.round(size * 100)}`,
        `Hero ${pos[0].toUpperCase()}${pos.slice(1)} ${Math.round(size * 100)}`,
        count,
        placeholders
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Family 3: Split — two unequal zones (vertical or horizontal), each with its own
// proportionally-sized sub-grid. Distinct from Hero in that both zones can hold >1 photo.
// ---------------------------------------------------------------------------
function genSplit(count: number) {
  if (count < 3) return
  const ratios = [0.4]
  for (const ratio of ratios) {
    for (const vertical of [true, false]) {
      const firstCount = Math.max(1, Math.round(count * ratio))
      const secondCount = count - firstCount
      if (secondCount < 1) continue
      const zoneA = vertical
        ? { x0: 0, y0: 0, w: ratio, h: 1 }
        : { x0: 0, y0: 0, w: 1, h: ratio }
      const zoneB = vertical
        ? { x0: ratio, y0: 0, w: 1 - ratio, h: 1 }
        : { x0: 0, y0: ratio, w: 1, h: 1 - ratio }
      const a = placeGridInRect(0, firstCount, zoneA.x0, zoneA.y0, zoneA.w, zoneA.h)
      const b = placeGridInRect(firstCount, secondCount, zoneB.x0, zoneB.y0, zoneB.w, zoneB.h)
      const placeholders = [...a, ...b]
      const axis = vertical ? 'V' : 'H'
      addTemplate(
        `gen-split-${count}-${axis}-${Math.round(ratio * 100)}`,
        `Split ${Math.round(ratio * 100)}/${Math.round((1 - ratio) * 100)} ${axis}`,
        count,
        placeholders
      )
      // Mirrored (bigger zone on the opposite side) — a genuinely different layout, not a dup.
      addTemplate(
        `gen-split-${count}-${axis}-${Math.round(ratio * 100)}-mir`,
        `Split ${Math.round((1 - ratio) * 100)}/${Math.round(ratio * 100)} ${axis}`,
        count,
        mirror(placeholders)
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Family 4: Filmstrip — equal strips, only while they stay wide enough to be usable.
// ---------------------------------------------------------------------------
function genFilmstrip(count: number) {
  if (count > 10) return
  const h = Array.from({ length: count }, (_, i) =>
    rect(`p${i}`, i * (1 / count), 0, 1 / count - GAP, 1 - GAP, 'portrait')
  )
  addTemplate(`gen-filmstrip-${count}-h`, `Filmstrip ${count}`, count, h)
  const v = Array.from({ length: count }, (_, i) =>
    rect(`p${i}`, 0, i * (1 / count), 1 - GAP, 1 / count - GAP, 'landscape')
  )
  addTemplate(`gen-filmstrip-${count}-v`, `Filmstrip ${count} Vertical`, count, v)
}

// ---------------------------------------------------------------------------
// Family 5: Mosaic — recursive guillotine split (always along the longer axis of the current
// rectangle), swept across a few different split-ratio "profiles" for distinct asymmetric looks.
// ---------------------------------------------------------------------------
const MOSAIC_PROFILES: Record<string, number[]> = {
  balanced: [0.5],
  golden: [0.382, 0.618],
  thirds: [0.333, 0.667],
  dynamic: [0.42, 0.58, 0.35, 0.65],
}

function mosaicSplit(
  idOffset: number,
  count: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  profile: number[],
  depth: number
): PlaceholderRect[] {
  if (count <= 1) {
    return [rect(`p${idOffset}`, x0 + GAP / 2, y0 + GAP / 2, w - GAP, h - GAP, orientationFor(w, h))]
  }
  const leftCount = Math.ceil(count / 2)
  const rightCount = count - leftCount
  const ratio = profile[depth % profile.length]
  const vertical = w >= h
  if (vertical) {
    const splitW = w * ratio
    return [
      ...mosaicSplit(idOffset, leftCount, x0, y0, splitW, h, profile, depth + 1),
      ...mosaicSplit(idOffset + leftCount, rightCount, x0 + splitW, y0, w - splitW, h, profile, depth + 1),
    ]
  }
  const splitH = h * ratio
  return [
    ...mosaicSplit(idOffset, leftCount, x0, y0, w, splitH, profile, depth + 1),
    ...mosaicSplit(idOffset + leftCount, rightCount, x0, y0 + splitH, w, h - splitH, profile, depth + 1),
  ]
}

function genMosaic(count: number) {
  if (count < 3) return
  for (const [name, profile] of Object.entries(MOSAIC_PROFILES)) {
    const placeholders = mosaicSplit(0, count, 0, 0, 1, 1, profile, 0)
    addTemplate(`gen-mosaic-${count}-${name}`, `Mosaic ${name[0].toUpperCase()}${name.slice(1)}`, count, placeholders)
  }
}

// ---------------------------------------------------------------------------
// Family 6: Collage — two photos intentionally overlapping (one drawn over the other, scrapbook-
// style) alongside the rest of the set in a supporting grid. Only for small counts, where a
// deliberate overlap still reads as a design choice rather than a mistake.
// ---------------------------------------------------------------------------
function genCollage(count: number) {
  if (count < 3 || count > 8) return
  for (const corner of ['tl', 'br'] as const) {
    const backW = 0.6
    const backH = 0.6
    const backX = corner === 'tl' ? 0.04 : 1 - backW - 0.04
    const backY = corner === 'tl' ? 0.04 : 1 - backH - 0.04
    const frontW = 0.42
    const frontH = 0.42
    const frontX = corner === 'tl' ? backX + backW - frontW * 0.55 : backX - frontW * 0.45
    const frontY = corner === 'tl' ? backY + backH - frontH * 0.55 : backY - frontH * 0.45
    const back = rect('p0', backX, backY, backW, backH, orientationFor(backW, backH))
    const front = rect('p1', Math.max(0.02, Math.min(1 - frontW - 0.02, frontX)), Math.max(0.02, Math.min(1 - frontH - 0.02, frontY)), frontW, frontH, orientationFor(frontW, frontH))
    // Remaining photos tile a strip opposite the collage pair.
    const stripVertical = corner === 'tl'
    const restRect = stripVertical
      ? { x0: 0.68, y0: 0, w: 0.32, h: 1 }
      : { x0: 0, y0: 0.68, w: 1, h: 0.32 }
    const rest = placeGridInRect(2, count - 2, restRect.x0, restRect.y0, restRect.w, restRect.h)
    const placeholders = [back, front, ...rest]
    addTemplate(`gen-collage-${count}-${corner}`, `Collage ${corner === 'tl' ? 'Top-Left' : 'Bottom-Right'}`, count, placeholders)
  }
}

for (let count = 1; count <= MAX_COUNT; count++) {
  genGrids(count)
  genHero(count)
  genSplit(count)
  genFilmstrip(count)
  genMosaic(count)
  genCollage(count)
}

export const GENERATED_TEMPLATES: TemplateDefinition[] = results
