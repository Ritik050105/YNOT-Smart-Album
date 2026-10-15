/** A small set of inline, stroke-style icons (no external icon library/font) used throughout
 *  the UI. Keeping them inline avoids a network dependency for core chrome. */
const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z M17 21v-8H7v8 M7 3v5h8',
  undo: 'M3 7v6h6 M3 13a9 9 0 1 0 3-6.7L3 9',
  redo: 'M21 7v6h-6 M21 13a9 9 0 1 1-3-6.7L21 9',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 21h16',
  image: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M21 15l-5-5L5 21',
  sparkles: 'M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  layers: 'M12 2 2 7l10 5 10-5-10-5Z M2 17l10 5 10-5 M2 12l10 5 10-5',
  grid: 'M3 3h7v7H3V3Z M14 3h7v7h-7V3Z M14 14h7v7h-7v-7Z M3 14h7v7H3v-7Z',
  type: 'M4 7V4h16v3 M9 20h6 M12 4v16',
  trash: 'M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 16v-5 M12 8h.01',
  chevronDown: 'M6 9l6 6 6-6',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M8.1 8.1 20 20 M8.1 15.9 20 4',
  merge: 'M8 3v7a4 4 0 0 0 4 4 4 4 0 0 0 4-4V3 M8 14v7 M16 14v7 M4 3h4 M16 3h4',
  upload: 'M12 21V9 M7 14l5-5 5 5 M4 3h16',
  palette: 'M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.2 4.2 0 0 0 22 11c0-5-4.5-9-10-9Z M6.5 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M9.5 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M14.5 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M17.5 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
  frame: 'M3 3h18v18H3V3Z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
  bookOpen: 'M2 5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15a1.5 1.5 0 0 0-1.5-1.5H2V5Z M22 5a2 2 0 0 0-2-2h-5a2 2 0 0 0-2 2v15a1.5 1.5 0 0 1 1.5-1.5H22V5Z',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18 M6 6l12 12',
  swatch: 'M3 3h18v18H3V3Z',
  droplet: 'M12 2s6 7 6 11.5a6 6 0 1 1-12 0C6 9 12 2 12 2Z',
  flipHorizontal: 'M12 3v18 M16 7l4 2-4 2 M8 7l-4 2 4 2 M16 15l4 2-4 2 M8 15l-4 2 4 2',
}

export default function Icon({
  name,
  size = 16,
  strokeWidth = 1.8,
  className,
}: {
  name: keyof typeof PATHS
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
