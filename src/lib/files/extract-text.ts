// ============================================================
// Text out of a file, in the browser — for Maya → Knowledge base →
// Files. Only the text is sent to the server: the file itself is never
// uploaded or stored, which keeps a 10 MB PDF off the server's memory
// and out of storage.
//
//   .txt .md .csv  read as UTF-8
//   .docx          a zip of XML: unzipped with the browser's own
//                  DecompressionStream, paragraphs pulled from
//                  word/document.xml — no library
//   .pdf           unpdf (PDF.js), loaded only when a PDF is picked
// ============================================================

export const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.csv', '.docx', '.pdf']

export class ExtractError extends Error {}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

/** Collapse the whitespace PDFs and Word files are full of. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractText(file: File): Promise<string> {
  const ext = extensionOf(file.name)
  if (ext === '.txt' || ext === '.md' || ext === '.csv') return tidy(await file.text())
  if (ext === '.docx') return tidy(await docxText(await file.arrayBuffer()))
  if (ext === '.pdf') return tidy(await pdfText(await file.arrayBuffer()))
  throw new ExtractError('Use a PDF, Word (.docx), TXT, MD or CSV file.')
}

async function pdfText(buffer: ArrayBuffer): Promise<string> {
  const { extractText: extract } = await import('unpdf')
  try {
    const { text } = await extract(new Uint8Array(buffer), { mergePages: true })
    if (!text.trim()) {
      throw new ExtractError(
        'No text found in this PDF — it may be scanned images. Copy the text into a Text source instead.',
      )
    }
    return text
  } catch (err) {
    if (err instanceof ExtractError) throw err
    throw new ExtractError('This PDF could not be read — it may be damaged or password-protected.')
  }
}

/* ─── .docx ──────────────────────────────────────────────────────── */

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

async function docxText(buffer: ArrayBuffer): Promise<string> {
  const xml = await readZipEntry(buffer, 'word/document.xml')
  if (xml === null) throw new ExtractError('This doesn’t look like a Word document.')
  // One line per paragraph; tabs and line breaks kept; every other tag
  // dropped, leaving the text runs.
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|apos);/g, (e) => XML_ENTITIES[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

/**
 * One file out of a zip, as text, or null when it isn't there. Reads
 * the central directory (the reliable sizes live there, not in the
 * local headers) and inflates with DecompressionStream('deflate-raw').
 */
async function readZipEntry(buffer: ArrayBuffer, wanted: string): Promise<string | null> {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // End of central directory: signature 0x06054b50, within the last
  // 64 KB + 22 bytes (the comment can be up to 64 KB).
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) return null

  const entries = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()

  for (let n = 0; n < entries; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) return null
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen))

    if (name === wanted) {
      const localNameLen = view.getUint16(localOffset + 26, true)
      const localExtraLen = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLen + localExtraLen
      const data = bytes.subarray(start, start + compressedSize)
      if (method === 0) return decoder.decode(data)
      if (method !== 8) return null
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      return new Response(stream).text()
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}
