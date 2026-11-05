/**
 * Reads the text of a PDF in the browser with pdf.js. The file never leaves the device.
 * pdf.js (~1 MB) is loaded only when the user actually picks a file.
 */

export const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PAGES = 10

export class PdfReadError extends Error {
  readonly reason: 'tooBig' | 'notPdf' | 'protected' | 'broken'
  constructor(reason: PdfReadError['reason'], cause?: unknown) {
    super(reason, { cause })
    this.reason = reason
  }
}

export interface Piece {
  x: number
  y: number
  w: number
  h: number
  str: string
}

export async function extractPdfText(file: File): Promise<string> {
  if (file.size > MAX_PDF_BYTES) throw new PdfReadError('tooBig')
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  if (String.fromCharCode(...head) !== '%PDF-') throw new PdfReadError('notPdf')

  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let doc: Awaited<typeof task.promise>
  try {
    doc = await task.promise
  } catch (error) {
    void task.destroy()
    throw new PdfReadError((error as { name?: string })?.name === 'PasswordException' ? 'protected' : 'broken', error)
  }

  try {
    const lines: string[] = []
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const pieces: Piece[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        pieces.push({
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: Math.abs(item.transform[3]) || 8,
          str: item.str,
        })
      }
      lines.push(...toLines(pieces))
      page.cleanup()
    }
    return lines.join('\n')
  } finally {
    void task.destroy()
  }
}

/** Groups text pieces into visual lines (top to bottom, left to right) so labels stay next to their values. */
export function toLines(pieces: Piece[]): string[] {
  pieces.sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Piece[][] = []
  for (const piece of pieces) {
    const row = rows.at(-1)
    if (row && Math.abs(row[0].y - piece.y) <= Math.max(2, Math.min(row[0].h, piece.h) * 0.5)) row.push(piece)
    else rows.push([piece])
  }
  // Pieces that touch are one word (Bangla often comes back one glyph cluster at a time);
  // a visible gap becomes a space.
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x)
    let line = ''
    let end = -Infinity
    for (const p of row) {
      if (line && p.x - end > Math.max(1, p.h * 0.18)) line += ' '
      line += p.str
      end = p.x + p.w
    }
    return line.replace(/\s+/g, ' ').trim()
  })
}
