// Checks for screenshots sent through the Team MCP connector. Pure functions (no network), so they can be tested alone:
//   node --test upload_test.ts     or     deno test upload_test.ts
// Why they exist: Claude has to copy long base64 text by hand and often cuts it short, which used to be saved as a broken image.
// Every upload now carries the byte count and the sha256 of the real file, and nothing is saved unless both match.

export class Plain extends Error {} // a message safe to show the person

export const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const MAX_IMAGE = 3_000_000; // bytes
export const CHUNK_MAX = 1500; // base64 characters per chunk (1125 bytes)

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sha256 = async (bytes: Uint8Array) => hex(await crypto.subtle.digest('SHA-256', bytes));

// Base64 text -> bytes. A cut-off string is not a multiple of 4 characters, which is the usual sign of truncation.
export function fromBase64(text: string): Uint8Array {
  const t = String(text ?? '').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Plain('The image is not valid base64.');
  if (t.length % 4 !== 0) throw new Plain(`The base64 text is cut off (${t.length} characters, not a multiple of 4). Nothing was saved. Use start_upload, upload_chunk and finish_upload.`);
  return Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
}

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const SIGNATURE: Record<string, (b: Uint8Array) => boolean> = {
  'image/png': (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': (b) => starts(b, [0xff, 0xd8, 0xff]),
  'image/webp': (b) => starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8), // "RIFF" .... "WEBP"
};

export const isHash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

// The one gate every image passes: real size, real hash, real PNG/JPEG/WebP bytes. Throws a plain sentence, never saves.
export async function checkImage(bytes: Uint8Array, want: { mime: string; size: number; sha256: string }) {
  if (!(want.mime in EXT)) throw new Plain('Only PNG, JPEG or WebP images.');
  if (!Number.isInteger(want.size) || want.size < 1) throw new Plain('size must be the number of bytes of the image.');
  if (!isHash(want.sha256)) throw new Plain('sha256 must be 64 lowercase hex characters, of the decoded image bytes.');
  if (bytes.length > MAX_IMAGE) throw new Plain('The image is too big (limit about 3 MB). Attach it on the item page in the dashboard.');
  if (bytes.length !== want.size) {
    throw new Plain(`Size mismatch: received ${bytes.length} bytes, expected ${want.size}. The text was probably cut off or changed. Nothing was saved.`);
  }
  const got = await sha256(bytes);
  if (got !== want.sha256) {
    throw new Plain(`Hash mismatch: received ${bytes.length} bytes with sha256 ${got}, expected ${want.sha256}. Nothing was saved.`);
  }
  if (!SIGNATURE[want.mime](bytes)) throw new Plain(`The bytes are not a real ${want.mime} file. Nothing was saved.`);
  return bytes;
}

// One chunk: at most CHUNK_MAX base64 characters, and its sha256 (of the decoded chunk bytes) must match.
export async function checkChunk(data: string, chunkSha256: string) {
  if (String(data ?? '').replace(/\s/g, '').length > CHUNK_MAX) throw new Plain(`A chunk is at most ${CHUNK_MAX} base64 characters. Send smaller pieces.`);
  const bytes = fromBase64(data);
  if (bytes.length === 0) throw new Plain('The chunk is empty.');
  if ((await sha256(bytes)) !== chunkSha256) throw new Plain('Chunk mismatch, resend');
  return bytes;
}

// Chunks may arrive in any order; join them by index and refuse gaps.
export function joinChunks(chunks: { index: number; data: string }[]): Uint8Array {
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  sorted.forEach((c, i) => {
    if (c.index !== i) throw new Plain(`Chunk ${i} is missing. Send it with upload_chunk, then call finish_upload again.`);
  });
  const parts = sorted.map((c) => fromBase64(c.data));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// finish_upload: join, then the same gate as a direct upload (which says which check failed).
export const assemble = async (chunks: { index: number; data: string }[], want: { mime: string; size: number; sha256: string }) =>
  checkImage(joinChunks(chunks), want);
