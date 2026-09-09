import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
test('every source PNG has valid chunks, checksums and a decodable pixel stream', () => {
  const dir = new URL('../src/uploads/', import.meta.url)
  for (const name of readdirSync(dir).filter((name) => name.endsWith('.png'))) {
    const bytes = readFileSync(new URL(name, dir))
    assert.ok(bytes.subarray(0, 8).equals(signature), name)
    const streams = []
    let ended = false
    for (let offset = 8; offset < bytes.length;) {
      const size = bytes.readUInt32BE(offset)
      const end = offset + 12 + size
      assert.ok(end <= bytes.length, `${name}: truncated chunk`)
      const type = bytes.toString('ascii', offset + 4, offset + 8)
      assert.equal(crc32(bytes.subarray(offset + 4, end - 4)), bytes.readUInt32BE(end - 4), `${name}: ${type} CRC`)
      if (type === 'IDAT') streams.push(bytes.subarray(offset + 8, end - 4))
      if (type === 'IEND') ended = true
      offset = end
    }
    assert.ok(ended && streams.length, `${name}: incomplete PNG`)
    assert.ok(inflateSync(Buffer.concat(streams)).length > 0, name)
  }
})
