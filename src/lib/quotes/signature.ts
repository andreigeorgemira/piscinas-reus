/**
 * Is this actually a PNG?
 *
 * The signature arrives as a data URL from a canvas, which always produces a
 * valid PNG -- but the field is a POST body like any other, and the column is
 * text. A value that merely STARTS like a PNG data URL and is truncated or
 * invented sails past a prefix check and reaches @react-pdf, which logs
 * "Incomplete or corrupt PNG file" and then retries the image until the request
 * gives up: the office asks for a PDF and gets a hang, on a document they can
 * no longer print at all.
 *
 * So the bytes are decoded and checked against the PNG signature, the eight
 * bytes every PNG begins with. Cheap, and it turns a hang into a quote that
 * prints without a picture.
 */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const PREFIX = 'data:image/png;base64,'

export function isPngDataUrl(value: string | null | undefined, maxLength = 300_000): boolean {
  if (!value || !value.startsWith(PREFIX) || value.length > maxLength) return false

  const encoded = value.slice(PREFIX.length)
  if (encoded.length < 16) return false

  try {
    // Only the head is decoded: the magic is in the first eight bytes, and
    // decoding a 300 kB string to look at eight of them is work for nothing.
    const head = Buffer.from(encoded.slice(0, 24), 'base64')
    if (head.length < PNG_MAGIC.length) return false
    return PNG_MAGIC.every((byte, index) => head[index] === byte)
  } catch {
    return false
  }
}
