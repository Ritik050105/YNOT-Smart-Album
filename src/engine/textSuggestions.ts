/** Curated quotes paired with a matching typography "design" (font, size, color, alignment,
 *  style) — picking one inserts a text box that already looks considered instead of generic
 *  black Georgia placeholder text. Tagged by event type so the picker can prioritize quotes
 *  that actually fit the job (a wedding quote looks odd on a concert spread). */
export interface QuoteSuggestion {
  text: string
  eventTypes: string[] // EVENT_TYPES this quote suits; 'Any' matches everything
  fontFamily: string
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
}

export const QUOTE_SUGGESTIONS: QuoteSuggestion[] = [
  { text: 'And so the adventure begins…', eventTypes: ['Wedding', 'Destination Wedding'], fontFamily: 'EB Garamond', fontSize: 34, color: '#2f2f2f', align: 'center', bold: false, italic: true },
  { text: 'Two souls, one heart, one love.', eventTypes: ['Wedding', 'Engagement'], fontFamily: 'Great Vibes', fontSize: 48, color: '#7a5a3a', align: 'center', bold: false, italic: false },
  { text: 'Forever starts today.', eventTypes: ['Wedding'], fontFamily: 'Playfair Display', fontSize: 36, color: '#1c1d21', align: 'center', bold: true, italic: false },
  { text: 'A love story written in every frame.', eventTypes: ['Wedding', 'Destination Wedding'], fontFamily: 'Cormorant Garamond', fontSize: 30, color: '#3a3a3a', align: 'center', bold: false, italic: true },
  { text: 'Happily ever after begins here.', eventTypes: ['Wedding'], fontFamily: 'Dancing Script', fontSize: 42, color: '#8a4a4a', align: 'center', bold: false, italic: false },
  { text: 'The best thing to hold onto in life is each other.', eventTypes: ['Wedding', 'Engagement'], fontFamily: 'EB Garamond', fontSize: 26, color: '#2f2f2f', align: 'center', bold: false, italic: true },
  { text: 'She said yes.', eventTypes: ['Engagement'], fontFamily: 'Great Vibes', fontSize: 52, color: '#7a5a3a', align: 'center', bold: false, italic: false },
  { text: 'The beginning of forever.', eventTypes: ['Engagement'], fontFamily: 'Playfair Display', fontSize: 32, color: '#1c1d21', align: 'center', bold: true, italic: false },
  { text: 'Where it all began.', eventTypes: ['Destination Wedding'], fontFamily: 'Marcellus', fontSize: 30, color: '#2f2f2f', align: 'center', bold: false, italic: false },
  { text: 'Love travels far.', eventTypes: ['Destination Wedding'], fontFamily: 'Cormorant Garamond', fontSize: 34, color: '#3a3a3a', align: 'center', bold: false, italic: true },
  { text: 'Every heartbeat whispers your name.', eventTypes: ['Wedding', 'Reception'], fontFamily: 'EB Garamond', fontSize: 28, color: '#2f2f2f', align: 'center', bold: false, italic: true },
  { text: 'Celebrating the melody of the moment.', eventTypes: ['Concert'], fontFamily: 'Oswald', fontSize: 30, color: '#1c1d21', align: 'center', bold: true, italic: false },
  { text: 'Live music, live memories.', eventTypes: ['Concert'], fontFamily: 'Montserrat', fontSize: 26, color: '#2f2f2f', align: 'center', bold: true, italic: false },
  { text: 'A little heartbeat, a lifetime of love.', eventTypes: ['Maternity'], fontFamily: 'EB Garamond', fontSize: 30, color: '#7a5a5a', align: 'center', bold: false, italic: true },
  { text: 'Counting down to the sweetest arrival.', eventTypes: ['Maternity'], fontFamily: 'Cormorant Garamond', fontSize: 28, color: '#3a3a3a', align: 'center', bold: false, italic: true },
  { text: 'Blooming into motherhood.', eventTypes: ['Maternity'], fontFamily: 'Dancing Script', fontSize: 40, color: '#8a4a4a', align: 'center', bold: false, italic: false },
  { text: 'Blessings on this joyful milestone.', eventTypes: ['Puberty'], fontFamily: 'Marcellus', fontSize: 28, color: '#2f2f2f', align: 'center', bold: false, italic: false },
  { text: 'A beautiful new chapter begins.', eventTypes: ['Puberty', 'Any'], fontFamily: 'EB Garamond', fontSize: 28, color: '#2f2f2f', align: 'center', bold: false, italic: true },
  { text: 'Moments like these last forever.', eventTypes: ['Any'], fontFamily: 'Playfair Display', fontSize: 28, color: '#1c1d21', align: 'center', bold: false, italic: false },
  { text: 'Captured in time, cherished forever.', eventTypes: ['Any'], fontFamily: 'Cormorant Garamond', fontSize: 28, color: '#3a3a3a', align: 'center', bold: false, italic: true },
]

/** Returns quotes relevant to a project's event type first, then everything else — so the
 *  picker leads with suggestions that actually fit the job. */
export function quotesForEventType(eventType: string): QuoteSuggestion[] {
  const matching = QUOTE_SUGGESTIONS.filter((q) => q.eventTypes.includes(eventType))
  const rest = QUOTE_SUGGESTIONS.filter((q) => !q.eventTypes.includes(eventType))
  return [...matching, ...rest]
}
