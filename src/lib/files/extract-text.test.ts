import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { ExtractError, extractText } from './extract-text'

/** A minimal zip holding one deflated entry — the shape of a .docx. */
function zip(name: string, content: string): Uint8Array {
  const nameBytes = Buffer.from(name)
  const data = deflateRawSync(Buffer.from(content))

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(8, 8) // deflate
  local.writeUInt32LE(data.length, 18)
  local.writeUInt16LE(nameBytes.length, 26)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt16LE(nameBytes.length, 28)
  central.writeUInt32LE(0, 42) // local header at the start

  const centralOffset = local.length + nameBytes.length + data.length
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(central.length + nameBytes.length, 12)
  eocd.writeUInt32LE(centralOffset, 16)

  return new Uint8Array(Buffer.concat([local, nameBytes, data, central, nameBytes, eocd]))
}

// Copied into a plain ArrayBuffer-backed array: File won't take one
// that may sit on a Node Buffer's shared pool.
const asFile = (bytes: Uint8Array | string, name: string) =>
  new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name)

describe('extractText', () => {
  it('reads paragraphs, tabs and entities out of a .docx', async () => {
    const xml =
      '<w:document><w:body>' +
      '<w:p><w:r><w:t>Returns &amp; refunds</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Within</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve"> 7 days</w:t></w:r></w:p>' +
      '</w:body></w:document>'
    const text = await extractText(asFile(zip('word/document.xml', xml), 'policy.docx'))
    expect(text).toBe('Returns & refunds\nWithin\t 7 days')
  })

  it('says so when a .docx has no document inside', async () => {
    await expect(extractText(asFile(zip('other.xml', '<x/>'), 'odd.docx'))).rejects.toBeInstanceOf(
      ExtractError,
    )
  })

  it('reads plain text and tidies its blank lines', async () => {
    expect(await extractText(asFile('a\r\n\n\n\nb  \n', 'notes.txt'))).toBe('a\n\nb')
  })

  it('refuses a file type it cannot read', async () => {
    await expect(extractText(asFile('x', 'slides.pptx'))).rejects.toBeInstanceOf(ExtractError)
  })
})
