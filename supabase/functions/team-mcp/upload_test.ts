// Run: node --test upload_test.ts   (Node 22+)   or   deno test upload_test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble, checkChunk, checkImage, fromBase64, sha256 } from './upload.ts';

// A tiny but real PNG-looking file: the 8 signature bytes plus filler (the check looks at the signature, not the picture).
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 3000 }, (_, i) => (i * 7) % 256)]);
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: Error) => re.test(e.message));
const meta = async () => ({ mime: 'image/png', size: png.length, sha256: await sha256(png) });

test('a correct upload is accepted', async () => {
  const out = await checkImage(fromBase64(b64(png)), await meta());
  assert.deepEqual(out, png);
});

test('a wrong hash is rejected, showing size and hash', async () => {
  const m = { ...(await meta()), sha256: 'a'.repeat(64) };
  await rejects(checkImage(png, m), /Hash mismatch: received 3008 bytes with sha256 [0-9a-f]{64}/);
});

test('truncated base64 is rejected', async () => {
  assert.throws(() => fromBase64(b64(png).slice(0, -3)), /cut off/);
  // cut on a 4-character boundary: decodes fine but the size check catches it
  await rejects(checkImage(fromBase64(b64(png).slice(0, 2000)), await meta()), /Size mismatch: received \d+ bytes, expected 3008/);
});

test('bytes that are not a real image are rejected', async () => {
  const fake = new Uint8Array(500).fill(65);
  await rejects(checkImage(fake, { mime: 'image/png', size: 500, sha256: await sha256(fake) }), /not a real image\/png/);
});

test('chunks arriving out of order still join correctly', async () => {
  const step = 1125;
  const chunks = [];
  for (let i = 0; i * step < png.length; i++) chunks.push({ index: i, data: b64(png.slice(i * step, (i + 1) * step)) });
  const shuffled = [chunks[2], chunks[0], chunks[1]];
  assert.equal(chunks.length, 3);
  assert.deepEqual(await assemble(shuffled, await meta()), png);
  await rejects(assemble([chunks[0], chunks[2]], await meta()), /Chunk 1 is missing/);
});

test('a bad chunk is rejected and the retry succeeds', async () => {
  const piece = png.slice(0, 1125);
  await rejects(checkChunk(b64(piece), 'b'.repeat(64)), /Chunk mismatch, resend/);
  assert.deepEqual(await checkChunk(b64(piece), await sha256(piece)), piece);
  await rejects(checkChunk('A'.repeat(1504), 'c'.repeat(64)), /at most 1500/);
});
