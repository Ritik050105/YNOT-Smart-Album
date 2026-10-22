import { PDFDocument, PDFDict, PDFName, PDFString, PDFHexString } from 'pdf-lib'
import { v4 as uuid } from 'uuid'
import profileUrl from '@/assets/sRGB2014.icc?url'

/** The canvas renderer produces sRGB pixels; label that space explicitly for print exchange. */
export async function savePdfX3(pdf: PDFDocument, title: string): Promise<Uint8Array> {
  const response = await fetch(profileUrl)
  if (!response.ok) throw new Error('Could not load the print color profile.')
  const profileBytes = new Uint8Array(await response.arrayBuffer())
  if (String.fromCharCode(...profileBytes.slice(36, 40)) !== 'acsp') throw new Error('Invalid print color profile.')
  const profile = pdf.context.register(pdf.context.flateStream(profileBytes, { N: 3, Alternate: 'DeviceRGB' }))
  pdf.catalog.set(PDFName.of('OutputIntents'), pdf.context.obj([pdf.context.obj({
    Type: 'OutputIntent', S: 'GTS_PDFX', OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    Info: PDFString.of('sRGB2014'), OutputCondition: PDFString.of('sRGB color-managed RGB exchange'), RegistryName: PDFString.of('https://www.color.org'), DestOutputProfile: profile,
  })]))
  pdf.setTitle(title)
  pdf.setCreator('YNOT Album Studio')
  const info = pdf.context.lookup(pdf.context.trailerInfo.Info, PDFDict)
  info.set(PDFName.of('GTS_PDFXVersion'), PDFString.of('PDF/X-3:2002'))
  info.set(PDFName.of('Trapped'), PDFName.of('False'))
  const identifier = PDFHexString.of(uuid().replace(/-/g, ''))
  pdf.context.trailerInfo.ID = pdf.context.obj([identifier, identifier])
  for (const page of pdf.getPages()) {
    page.setTrimBox(0, 0, page.getWidth(), page.getHeight())
  }
  const bytes = await pdf.save({ useObjectStreams: false })
  // pdf-lib writes 1.7 even without object streams; this raster-only document uses PDF 1.3 features.
  bytes.set(new TextEncoder().encode('%PDF-1.3'), 0)
  return bytes
}
