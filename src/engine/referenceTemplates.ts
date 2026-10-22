import { PlaceholderRect, TemplateDefinition } from '@/types'
import { distributeEvenly, geometrySignature, orientationFor, rect } from './templateLayout'

// Original frame compositions inspired by public Studio PK, Opus and Smart Photo Selection previews.
// No third-party photographs, PSDs, artwork or text are bundled.
export function expandTemplateLibrary(existing: TemplateDefinition[]): TemplateDefinition[] {
  const additions: TemplateDefinition[] = []
  const signatures = new Set(existing.map(t => `${t.photoCount}:${geometrySignature(t.placeholders)}`))
  const positions = ['Start', 'Centre', 'End']
  for (let count = 1; count <= 30; count++) {
    let available = existing.filter(t => t.photoCount === count && t.id !== 'cover-front-spine-back').length
    function add(family: string, recipe: number, name: string, frames: PlaceholderRect[]) {
      if (available >= 300 || frames.length !== count || frames.some(p => ![p.x, p.y, p.width, p.height].every(Number.isFinite) || p.width < 0.025 || p.height < 0.025 || p.x < 0 || p.y < 0 || p.x + p.width > 1.000001 || p.y + p.height > 1.000001)) return
      const signature = `${count}:${geometrySignature(frames)}`
      if (signatures.has(signature)) return
      signatures.add(signature)
      additions.push({ id: `ref-${family}-${count}-${recipe}`, name, photoCount: count, pageSide: 'spread', placeholders: frames, isBuiltIn: true, createdAt: new Date(0).toISOString(), thumbnailColor: existing[(recipe + count) % existing.length].thumbnailColor })
      available++
    }
    if (count === 1) {
      const sizes = [1, 0.76, 0.52, 0.88, 0.4, 0.64, 0.28]
      for (let recipe = 0; recipe < 441 && available < 300; recipe++) {
        const w = sizes[recipe % 7], h = sizes[Math.floor(recipe / 7) % 7]
        const anchor = Math.floor(recipe / 49), ax = anchor % 3, ay = Math.floor(anchor / 3)
        add('editorial', recipe, `Editorial ${positions[ax]} ${positions[ay]} · ${Math.round(w * 100)}×${Math.round(h * 100)}`, [rect('p0', (1 - w) * ax / 2, (1 - h) * ay / 2, w, h, orientationFor(w, h))])
      }
      continue
    }
    for (let recipe = 0; recipe < 1200 && available < 300; recipe++) {
      const margin = [0.025, 0.07, 0.12, 0][recipe % 4]
      const gap = [0.014, 0.028, 0.042][Math.floor(recipe / 4) % 3]
      const bounds = { x: margin, y: margin, width: 1 - margin * 2, height: 1 - margin * 2 }
      const variant = Math.floor(recipe / 12) * 7 + Math.floor(recipe / 4) % 3
      const vertical = variant % 2 === 0
      // Two independently tiled pages, with a clear centre gutter.
      const leftCount = variant % 3 === 0 ? Math.ceil(count / 2) : 1 + Math.floor(variant / 2) % (count - 1)
      const pair = [
        ...tile(leftCount, { ...bounds, width: bounds.width / 2 - gap / 2 }, variant, gap),
        ...tile(count - leftCount, { ...bounds, x: 0.5 + gap / 2, width: bounds.width / 2 - gap / 2 }, variant + 5, gap),
      ]
      add('paired', recipe, `Paired Pages ${leftCount}+${count - leftCount} · ${recipe + 1}`, identify(pair))

      // A dominant portrait or banner with a separate supporting sequence.
      const fraction = [0.34, 0.46, 0.58, 0.7][Math.floor(variant / 2) % 4]
      const extent = (vertical ? bounds.width : bounds.height) * fraction - gap / 2
      const hero = { ...bounds, ...(vertical ? { width: extent } : { height: extent }) }
      const support = vertical
        ? { ...bounds, x: bounds.x + extent + gap, width: bounds.width - extent - gap }
        : { ...bounds, y: bounds.y + extent + gap, height: bounds.height - extent - gap }
      let heroFrames = identify([hero, ...tile(count - 1, support, variant + 2, gap)])
      if (Math.floor(variant / 8) % 2) heroFrames = heroFrames.map(p => ({ ...p, x: 1 - p.x - p.width, y: 1 - p.y - p.height }))
      add('editorial', recipe, `Editorial ${vertical ? 'Portrait' : 'Banner'} · ${recipe + 1}`, heroFrames)

      // Storytelling rows/columns alternate dense detail strips and larger moments.
      const bands = Math.min(count, 2 + Math.floor(variant / 2) % 4)
      const counts = distributeEvenly(count, bands)
      if (Math.floor(variant / 8) % 2) counts.reverse()
      const weights = counts.map((_, i) => 1 + ((i + variant) % 3) * 0.5)
      const total = weights.reduce((sum, w) => sum + w, 0)
      let cursor = vertical ? bounds.x : bounds.y
      const story: Box[] = []
      counts.forEach((n, i) => {
        const length = ((vertical ? bounds.width : bounds.height) - gap * (bands - 1)) * weights[i] / total
        const band = vertical ? { ...bounds, x: cursor, width: length } : { ...bounds, y: cursor, height: length }
        story.push(...tile(n, band, variant + i, gap))
        cursor += length + gap
      })
      add('storyboard', recipe, `Storyboard ${vertical ? 'Columns' : 'Rows'} · ${recipe + 1}`, identify(story))
      add('mosaic', recipe, `Salon Mosaic · ${recipe + 1}`, identify(tile(count, bounds, variant * 7 + 3, gap)))
    }
    if (available < 300) throw new Error(`Only ${available} valid layouts for ${count} photos`)
  }
  return additions
}

type Box = { x: number; y: number; width: number; height: number }
function identify(boxes: Box[]): PlaceholderRect[] {
  return boxes.map((p, i) => rect(`p${i}`, p.x, p.y, p.width, p.height, orientationFor(p.width, p.height)))
}

function tile(count: number, box: Box, seed: number, gap: number): Box[] {
  if (count === 1) return [box]
  const first = Math.max(1, Math.min(count - 1, Math.round(count * [0.4, 0.5, 0.6][seed % 3])))
  const vertical = box.width * 2 > box.height * (seed % 4 === 0 ? 1.7 : 1)
  const fraction = Math.max(0.25, Math.min(0.75, first / count + [-0.06, 0, 0.06][Math.floor(seed / 3) % 3]))
  const length = ((vertical ? box.width : box.height) - gap) * fraction
  const a = vertical ? { ...box, width: length } : { ...box, height: length }
  const b = vertical
    ? { ...box, x: box.x + length + gap, width: box.width - length - gap }
    : { ...box, y: box.y + length + gap, height: box.height - length - gap }
  return [...tile(first, a, seed + 5, gap), ...tile(count - first, b, seed + 11, gap)]
}
