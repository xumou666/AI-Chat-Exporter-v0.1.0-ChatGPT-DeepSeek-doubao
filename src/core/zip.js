/*
 * AI Chat Exporter — dependency-free ZIP writer (store method, UTF-8 names)
 * plus a small central-directory reader used by the test-suite.
 * Exposes: globalThis.AIChatExporter.core.zip
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function encodeUtf8(text) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(String(text));
    var utf8 = unescape(encodeURIComponent(String(text)));
    var out = new Uint8Array(utf8.length);
    for (var i = 0; i < utf8.length; i++) out[i] = utf8.charCodeAt(i);
    return out;
  }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder === 'function') return new TextDecoder('utf-8').decode(bytes);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(binary));
  }

  function toBytes(data) {
    if (data == null) return new Uint8Array(0);
    // Realm-agnostic checks: a Uint8Array coming from another window/iframe
    // fails `instanceof` but is still a typed array view.
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    if (Object.prototype.toString.call(data) === '[object ArrayBuffer]') return new Uint8Array(data);
    if (Array.isArray(data)) return new Uint8Array(data);
    return encodeUtf8(data);
  }

  function dosDateTime(date) {
    var d = date instanceof Date ? date : new Date(date || Date.now());
    var year = Math.max(1980, d.getFullYear());
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31);
    var day = (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time, date: day };
  }

  /**
   * entries: [{ name, data: string|Uint8Array, date? }]
   * returns Uint8Array
   */
  function zipSync(entries, options) {
    options = options || {};
    var when = dosDateTime(options.date || Date.now());
    var prepared = [];
    var localSize = 0;
    var centralSize = 0;

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!entry || !entry.name) continue;
      var nameBytes = encodeUtf8(String(entry.name).replace(/\\/g, '/'));
      var dataBytes = toBytes(entry.data);
      var stamp = entry.date ? dosDateTime(entry.date) : when;
      prepared.push({
        nameBytes: nameBytes,
        dataBytes: dataBytes,
        crc: crc32(dataBytes),
        time: stamp.time,
        date: stamp.date,
        offset: 0
      });
      localSize += 30 + nameBytes.length + dataBytes.length;
      centralSize += 46 + nameBytes.length;
    }

    var total = localSize + centralSize + 22;
    var buffer = new ArrayBuffer(total);
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    var offset = 0;

    for (var p = 0; p < prepared.length; p++) {
      var item = prepared[p];
      item.offset = offset;
      view.setUint32(offset, 0x04034b50, true); offset += 4; // local file header
      view.setUint16(offset, 20, true); offset += 2;         // version needed
      view.setUint16(offset, 0x0800, true); offset += 2;     // flags: UTF-8 names
      view.setUint16(offset, 0, true); offset += 2;          // method: store
      view.setUint16(offset, item.time, true); offset += 2;
      view.setUint16(offset, item.date, true); offset += 2;
      view.setUint32(offset, item.crc, true); offset += 4;
      view.setUint32(offset, item.dataBytes.length, true); offset += 4;
      view.setUint32(offset, item.dataBytes.length, true); offset += 4;
      view.setUint16(offset, item.nameBytes.length, true); offset += 2;
      view.setUint16(offset, 0, true); offset += 2;          // extra length
      bytes.set(item.nameBytes, offset); offset += item.nameBytes.length;
      bytes.set(item.dataBytes, offset); offset += item.dataBytes.length;
    }

    var centralStart = offset;
    for (var c = 0; c < prepared.length; c++) {
      var entry2 = prepared[c];
      view.setUint32(offset, 0x02014b50, true); offset += 4; // central directory header
      view.setUint16(offset, 20, true); offset += 2;         // version made by
      view.setUint16(offset, 20, true); offset += 2;         // version needed
      view.setUint16(offset, 0x0800, true); offset += 2;     // flags
      view.setUint16(offset, 0, true); offset += 2;          // method
      view.setUint16(offset, entry2.time, true); offset += 2;
      view.setUint16(offset, entry2.date, true); offset += 2;
      view.setUint32(offset, entry2.crc, true); offset += 4;
      view.setUint32(offset, entry2.dataBytes.length, true); offset += 4;
      view.setUint32(offset, entry2.dataBytes.length, true); offset += 4;
      view.setUint16(offset, entry2.nameBytes.length, true); offset += 2;
      view.setUint16(offset, 0, true); offset += 2;          // extra
      view.setUint16(offset, 0, true); offset += 2;          // comment
      view.setUint16(offset, 0, true); offset += 2;          // disk number
      view.setUint16(offset, 0, true); offset += 2;          // internal attrs
      view.setUint32(offset, 0, true); offset += 4;          // external attrs
      view.setUint32(offset, entry2.offset, true); offset += 4;
      bytes.set(entry2.nameBytes, offset); offset += entry2.nameBytes.length;
    }
    var centralEnd = offset;

    view.setUint32(offset, 0x06054b50, true); offset += 4;   // end of central directory
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2;
    view.setUint16(offset, prepared.length, true); offset += 2;
    view.setUint16(offset, prepared.length, true); offset += 2;
    view.setUint32(offset, centralEnd - centralStart, true); offset += 4;
    view.setUint32(offset, centralStart, true); offset += 4;
    view.setUint16(offset, 0, true); offset += 2;
    return bytes;
  }

  /** Minimal reader used by tests to prove the archive is well formed. */
  function listEntries(bytes) {
    var view = new DataView(bytes.buffer ? bytes.buffer : bytes, bytes.byteOffset || 0, bytes.byteLength || bytes.length);
    var length = view.byteLength;
    var eocd = -1;
    for (var i = length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd === -1) throw new Error('not a zip file: EOCD not found');
    var count = view.getUint16(eocd + 10, true);
    var centralOffset = view.getUint32(eocd + 16, true);
    var out = [];
    var cursor = centralOffset;
    for (var e = 0; e < count; e++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('bad central directory entry at ' + cursor);
      var crc = view.getUint32(cursor + 16, true);
      var compressedSize = view.getUint32(cursor + 20, true);
      var size = view.getUint32(cursor + 24, true);
      var nameLength = view.getUint16(cursor + 28, true);
      var extraLength = view.getUint16(cursor + 30, true);
      var commentLength = view.getUint16(cursor + 32, true);
      var localOffset = view.getUint32(cursor + 42, true);
      var name = decodeUtf8(new Uint8Array(view.buffer, view.byteOffset + cursor + 46, nameLength));
      out.push({ name: name, crc: crc, size: size, compressedSize: compressedSize, localOffset: localOffset });
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return out;
  }

  /** Reads one stored (uncompressed) entry back — again, mainly for tests. */
  function readEntry(bytes, name) {
    var view = new DataView(bytes.buffer ? bytes.buffer : bytes, bytes.byteOffset || 0, bytes.byteLength || bytes.length);
    var entry = null;
    var entries = listEntries(bytes);
    for (var i = 0; i < entries.length; i++) if (entries[i].name === name) entry = entries[i];
    if (!entry) return null;
    var offset = entry.localOffset;
    var nameLength = view.getUint16(offset + 26, true);
    var extraLength = view.getUint16(offset + 28, true);
    var dataStart = offset + 30 + nameLength + extraLength;
    return new Uint8Array(view.buffer, view.byteOffset + dataStart, entry.size);
  }

  core.zip = {
    crc32: crc32,
    zipSync: zipSync,
    listEntries: listEntries,
    readEntry: readEntry,
    encodeUtf8: encodeUtf8,
    decodeUtf8: decodeUtf8
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
