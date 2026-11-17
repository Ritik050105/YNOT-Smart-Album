import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/** Inlines the built stylesheet into index.html so first paint does not wait on a second request.
 *  The CSS's own relative url() references are rewritten to resolve from the page's folder. */
const inlineCss = (): Plugin => ({
  name: 'inline-css',
  enforce: 'post',
  transformIndexHtml(html, ctx) {
    if (!ctx.bundle) return html
    return html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/, (tag, file: string) => {
      const asset = ctx.bundle![file]
      return asset && asset.type === 'asset' ? `<style>${String(asset.source).replace(/url\(\.\//g, 'url(./assets/')}</style>` : tag
    })
  },
})

export default defineConfig({
  plugins: [react(), inlineCss()],
  base: './',
  // The face detector's model weights are a .bin imported with ?inline (src/engine/faceDetector.ts).
  assetsInclude: ['**/*.bin'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/dist-electron/**'],
    },
  },
  build: {
    outDir: 'dist',
    // The model weights must travel inside the JavaScript: a packaged app is opened from file://, which cannot fetch a neighbouring file.
    assetsInlineLimit: (file: string) => file.endsWith('.bin') ? true : undefined,
  },
})
