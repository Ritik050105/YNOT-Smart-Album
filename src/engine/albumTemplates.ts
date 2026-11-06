import { TemplateDefinition } from '@/types'

/** Layouts lifted from YNOT's own finished albums.
 *
 *  These are not invented: each one is a spread the studio actually designed and delivered, with
 *  the frame geometry read back out of the exported PDF. The photographs themselves play no part —
 *  only where the frames sat on the sheet.
 *
 *  They were drawn for a 36 x 12 album, so the proportions suit a wide spread; on a squarer album
 *  the same arrangement reads taller. Frames may cross the fold, because the studio's own designs
 *  do, which makes these full-spread layouts rather than two independent pages.
 *
 *  Coordinates are [x, y, width, height] as 0-1 fractions of the whole spread. */
const LAYOUTS: number[][][] = [
  // Spread 1 of the album
  [[0.052, 0.332, 0.1735, 0.668], [0.4795, 0, 0.2435, 1], [0.7645, 0.062, 0.1865, 0.938]],
  // Spread 2 of the album
  [[0, 0, 0.5, 1], [0.6515, 0.088, 0.1545, 0.912]],
  // Spread 4 of the album
  [[0, 0.1115, 0.192, 0.3855], [0, 0.503, 0.192, 0.3855], [0.1945, 0.1115, 0.127, 0.2525], [0.1945, 0.3725, 0.127, 0.255], [0.1945, 0.636, 0.127, 0.2525], [0.3245, 0.1115, 0.1745, 0.7775], [0.5015, 0.1115, 0.1745, 0.7775], [0.6785, 0.1115, 0.1265, 0.2525], [0.6785, 0.3725, 0.1265, 0.255], [0.6785, 0.636, 0.1265, 0.2525], [0.808, 0.1115, 0.192, 0.3855], [0.808, 0.503, 0.192, 0.3855]],
  // Spread 5 of the album
  [[0, 0, 0.3065, 1], [0.4265, 0.0365, 0.29, 0.9635], [0.75, 0.0555, 0.223, 0.4435], [0.75, 0.5075, 0.223, 0.4435]],
  // Spread 9 of the album
  [[0, 0, 0.247, 0.424], [0, 0.4325, 0.3315, 0.5675], [0.25, 0, 0.2485, 0.424], [0.3335, 0.4325, 0.333, 0.5675], [0.5015, 0, 0.2485, 0.424], [0.6685, 0.4325, 0.3315, 0.5675], [0.753, 0, 0.247, 0.424]],
  // Spread 10 of the album
  [[0, 0, 0.5, 1], [0.503, 0, 0.247, 0.497], [0.503, 0.503, 0.247, 0.497], [0.753, 0, 0.247, 0.497], [0.753, 0.546, 0.247, 0.454]],
  // Spread 11 of the album
  [[0, 0, 0.3315, 0.497], [0, 0.503, 0.3315, 0.497], [0.3335, 0.503, 0.333, 0.497], [0.3345, 0, 0.3315, 0.497], [0.6685, 0, 0.3315, 0.497], [0.6685, 0.503, 0.3315, 0.497]],
  // Spread 13 of the album
  [[0, 0, 0.3335, 1], [0.3355, 0, 0.2065, 0.4945], [0.3355, 0.503, 0.2065, 0.497], [0.5445, 0, 0.4555, 1]],
  // Spread 14 of the album
  [[0, 0, 0.29, 1], [0.293, 0.1265, 0.175, 0.3705], [0.293, 0.503, 0.175, 0.3705], [0.47, 0.1265, 0.1755, 0.3705], [0.47, 0.503, 0.1755, 0.3705], [0.648, 0.1265, 0.1755, 0.3705], [0.648, 0.503, 0.175, 0.3705], [0.8255, 0.1265, 0.1745, 0.3705], [0.8255, 0.503, 0.1745, 0.3705]],
  // Spread 16 of the album
  [[0, 0, 0.293, 0.497], [0, 0.503, 0.293, 0.497], [0.2955, 0, 0.1455, 0.242], [0.2955, 0.2505, 0.1455, 0.2465], [0.2955, 0.503, 0.2945, 0.497], [0.4445, 0, 0.1455, 0.242], [0.4445, 0.2505, 0.1455, 0.2465], [0.593, 0, 0.1915, 0.3275], [0.593, 0.336, 0.1915, 0.3275], [0.593, 0.6725, 0.1915, 0.3275], [0.787, 0, 0.213, 1]],
  // Spread 19 of the album
  [[0.002, 0, 0.4845, 1], [0.4885, 0.09, 0.1815, 0.407], [0.4885, 0.503, 0.1815, 0.407], [0.672, 0.09, 0.328, 0.82]],
  // Spread 21 of the album
  [[0, 0, 0.5, 1], [0.5345, 0.0835, 0.4295, 0.8395]],
  // Spread 25 of the album
  [[0, 0, 0.2155, 0.9185], [0.218, 0, 0.565, 1], [0.785, 0, 0.215, 1]],
  // Spread 39 of the album
  [[0, 0, 0.248, 0.497], [0, 0.503, 0.248, 0.497], [0.25, 0, 0.2485, 0.497], [0.25, 0.503, 0.2485, 0.497], [0.5015, 0, 0.2485, 0.497], [0.5535, 0.503, 0.1965, 0.497], [0.752, 0.503, 0.248, 0.497], [0.8095, 0, 0.1355, 0.497]],
]

export const ALBUM_TEMPLATES: TemplateDefinition[] = LAYOUTS.map((frames, index) => {
  const id = `ref-album-${index + 1}`
  return {
    id,
    name: `Album Study ${index + 1} · ${frames.length} Photos`,
    photoCount: frames.length,
    pageSide: 'spread',
    isBuiltIn: true,
    createdAt: new Date(0).toISOString(),
    thumbnailColor: '#7b6a58',
    placeholders: frames.map(([x, y, width, height], i) => ({
      id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any',
    })),
  }
})
