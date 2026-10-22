/** A small set of inline, stroke-style icons (no external icon library/font) used throughout
 *  the UI. Keeping them inline avoids a network dependency for core chrome. */
const PATHS: Record<string, string> = {
  home: 'M3 10l9-7 9 7v11h-6v-7H9v7H3V10Z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M15 5l4 4 M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z',
  flipSpread: 'M12 2v20 M8 5H3v14h5 M16 5h2 M21 5v3 M21 11v2 M21 16v3 M18 19h-2',
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
  chevronUp: 'M18 15l-6-6-6 6',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
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
  pattern: 'M6 6h.01 M12 6h.01 M18 6h.01 M6 12h.01 M12 12h.01 M18 12h.01 M6 18h.01 M12 18h.01 M18 18h.01',
  droplet: 'M12 2s6 7 6 11.5a6 6 0 1 1-12 0C6 9 12 2 12 2Z',
  flipHorizontal: 'M12 3v18 M16 7l4 2-4 2 M8 7l-4 2 4 2 M16 15l4 2-4 2 M8 15l-4 2 4 2',
  moon: 'M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z',
  panelLeft: 'M3 3h18v18H3V3Z M9 3v18',
  panelRight: 'M3 3h18v18H3V3Z M15 3v18',
  panelBottom: 'M3 3h18v18H3V3Z M3 15h18',
  filter: 'M4 4h16l-6 8v7l-4 2v-9L4 4Z',
  sort: 'M3 6h18 M3 12h12 M3 18h6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.3-4.3',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z',
  wand: 'M15 4V2 M15 16v-2 M8 9h2 M20 9h2 M17.8 6.2l1.4-1.4 M17.8 11.8l1.4 1.4 M3 21l9-9 M12.2 12.2 15 15',
  cursor: 'M4 3l16 8-7 1.5L11 20z',
  hand: 'M9 11.5V6a1.5 1.5 0 0 1 3 0v4.5 M12 10.3V4.5a1.5 1.5 0 0 1 3 0v6 M15 10.8V6.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6.5 7s-6-2-7.5-5L3 12.5a1.4 1.4 0 0 1 2.2-1.7L7 13V7a1.5 1.5 0 0 1 3 0v4.5',
  fitToView: 'M8 3H5a2 2 0 0 0-2 2v3 M16 3h3a2 2 0 0 1 2 2v3 M21 16v3a2 2 0 0 1-2 2h-3 M3 16v3a2 2 0 0 0 2 2h3',
  align: 'M12 2v4 M12 18v4 M2 12h4 M18 12h4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  play: 'M7 4l13 8-13 8V4Z',
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
