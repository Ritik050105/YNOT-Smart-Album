import { Project } from '@/types'
import { renderSpreadToCanvas } from './renderSpread'
import { canvasToBytes } from './exportUtil'
import { blobUrlToDataUrl } from './projectFile'
import ynotMarkWhite from '@/assets/ynot-mark-dark.png'

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:${mime};base64,${btoa(binary)}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * Builds a single self-contained HTML file showing every spread, for sharing with a client to
 * review — the practical, no-backend equivalent of "cloud proofing": you email/upload this one
 * file and they open it in any browser. It's a read-only snapshot, not a live synced session —
 * real-time shared review would need a hosted backend this desktop app doesn't have.
 */
export async function buildProofingGalleryHtml(project: Project): Promise<string> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const sorted = [...project.spreads].sort((a, b) => a.order - b.order)
  // Preview resolution — plenty sharp for on-screen review without bloating the file.
  const previewDpi = Math.min(project.size.dpi, 150)

  const cards: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    const spread = sorted[i]
    const canvas = await renderSpreadToCanvas(spread, photosById, project.size, previewDpi)
    const bytes = await canvasToBytes(canvas, 'image/jpeg', 0.85)
    const dataUrl = bytesToDataUrl(bytes, 'image/jpeg')
    cards.push(`
      <figure class="card">
        <img src="${dataUrl}" alt="Spread ${i + 1}" loading="lazy" onclick="openLightbox(this.src)" />
        <figcaption>Spread ${i + 1} &middot; ${escapeHtml(spread.pageSide)}</figcaption>
      </figure>`)
  }

  const generatedAt = new Date().toLocaleString()
  const logoDataUrl = await blobUrlToDataUrl(ynotMarkWhite).catch(() => null)
  const subtitleParts = [project.eventType, project.community, project.size.label].filter(Boolean)
  const clientLine = project.clientName ? escapeHtml(project.clientName) : escapeHtml(project.name)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(project.name)} — YNOT Photography Proofing Gallery</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f5f7; color: #1c1d21; }
  header { padding: 28px 24px; background: #ffffff; color: #18243c; display: flex; align-items: center; gap: 16px; }
  header .mark { width: 40px; height: 40px; flex-shrink: 0; background:#3157c8; mask-position:center; mask-size:contain; mask-repeat:no-repeat; }
  header .mark img { width: 100%; height: 100%; object-fit: contain; }
  header .titles { flex: 1; }
  header h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: 0.02em; }
  header p { margin: 0; color: #53627a; font-size: 12.5px; }
  header .brand { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6f7280; }
  main { padding: 24px; max-width: 1200px; margin: 0 auto; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
  .card { margin: 0; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  .card img { width: 100%; display: block; cursor: zoom-in; }
  .card figcaption { padding: 10px 12px; font-size: 13px; color: #555; text-transform: capitalize; }
  #lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; padding: 24px; cursor: zoom-out; z-index: 10; }
  #lightbox.open { display: flex; }
  #lightbox img { max-width: 100%; max-height: 100%; border-radius: 6px; }
  footer { text-align: center; padding: 24px; color: #9a9ca3; font-size: 12px; }
  footer strong { color: #5c6072; }
  @media print {
    header, footer, #lightbox { display: none; }
    .grid { grid-template-columns: 1fr; }
    .card { box-shadow: none; page-break-inside: avoid; }
  }
</style>
</head>
<body>
<header>
  ${logoDataUrl ? `<span class="mark" role="img" aria-label="YNOT Photography" style="mask-image:url('${logoDataUrl}')"></span>` : ''}
  <div class="titles">
    <div class="brand">YNOT Photography</div>
    <h1>${clientLine}</h1>
    <p>${subtitleParts.map(escapeHtml).join(' &middot; ')} &middot; ${sorted.length} spread${sorted.length === 1 ? '' : 's'} &middot; generated ${escapeHtml(generatedAt)}</p>
  </div>
</header>
<main>
  <div class="grid">
    ${cards.join('\n')}
  </div>
</main>
<footer>Click any spread to enlarge. This is a static snapshot for review — re-export and re-share after changes.<br/><strong>YNOT Photography</strong> &middot; ynot.website</footer>
<div id="lightbox" onclick="this.classList.remove('open')"><img id="lightbox-img" src="" alt="" /></div>
<script>
  function openLightbox(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('open');
  }
</script>
</body>
</html>`
}
