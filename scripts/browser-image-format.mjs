// Header/trailer preflight, not a replacement for codec decoding or visual source review.
export function browserImageFormat(name,bytes) {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png'
  if(!/\.jpe?g$/i.test(name) || bytes.length<5 || bytes.readUInt16BE(0)!==0xffd8 || bytes[2]!==0xff) return null
  // Four hash-pinned 103020/4308 PDF image streams include exactly 00 10 01 after EOI.
  // Keep the official stream intact; do not accept arbitrary suffixes or missing EOI.
  const end=bytes.subarray(-3).equals(Buffer.from([0,16,1])) ? bytes.length-5 : bytes.length-2
  return end>=3 && bytes.readUInt16BE(end)===0xffd9 ? 'jpeg' : null
}
