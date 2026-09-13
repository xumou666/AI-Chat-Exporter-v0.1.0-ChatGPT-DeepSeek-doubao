/*
 * ZIP writer tests — the archive must be readable by its own reader and by
 * standard tools (verified additionally with Expand-Archive in the docs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, fakePng } from './helpers/env.mjs';

function zipApi() {
  const { NS } = createEnv('generic-random.html');
  return NS.core.zip;
}

test('zipSync writes a store-method archive that lists and reads back', () => {
  const zip = zipApi();
  const text = '# 标题\n\n内容 with UTF-8 ✓\n';
  const png = fakePng(48);
  const bytes = zip.zipSync([
    { name: '导出.md', data: text },
    { name: 'images/chart.png', data: png }
  ]);

  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);

  const entries = zip.listEntries(bytes);
  assert.deepEqual(Array.from(entries, (e) => e.name), ['导出.md', 'images/chart.png']);
  assert.equal(entries[0].crc, zip.crc32(zip.encodeUtf8(text)));
  assert.equal(entries[1].size, png.length);

  assert.equal(zip.decodeUtf8(zip.readEntry(bytes, '导出.md')), text);
  assert.deepEqual(Array.from(zip.readEntry(bytes, 'images/chart.png')), Array.from(png));
  assert.equal(zip.readEntry(bytes, 'missing.txt'), null);
});

test('crc32 matches known values', () => {
  const zip = zipApi();
  assert.equal(zip.crc32(new Uint8Array(0)), 0);
  assert.equal(zip.crc32(zip.encodeUtf8('123456789')), 0xcbf43926);
});

test('empty archives are still valid', () => {
  const zip = zipApi();
  const bytes = zip.zipSync([]);
  assert.equal(bytes.length, 22);
  assert.deepEqual(Array.from(zip.listEntries(bytes)), []);
});
