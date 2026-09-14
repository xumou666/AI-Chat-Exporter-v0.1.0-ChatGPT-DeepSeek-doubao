/*
 * Test helper: boots the extension modules inside jsdom.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const CORE_FILES = [
  'src/core/dom.js',
  'src/core/markdown.js',
  'src/core/engine.js',
  'src/core/schema.js',
  'src/core/serialize.js',
  'src/core/html.js',
  'src/core/range.js',
  'src/core/zip.js',
  'src/core/images.js',
  'src/core/download.js',
  'src/core/pdf.js',
  'src/core/i18n.js',
  'src/core/app.js'
];

export const PLATFORM_FILES = [
  'src/platforms/chatgpt.js',
  'src/platforms/deepseek.js',
  'src/platforms/doubao.js',
  'src/platforms/generic.js',
  'src/platforms/index.js'
];

export const PANEL_FILES = ['src/ui/panel.js'];
export const BOOT_FILES = ['src/content.js'];
export const ALL_FILES = [...CORE_FILES, ...PLATFORM_FILES, ...PANEL_FILES, ...BOOT_FILES];

export const DEFAULT_URLS = {
  'chatgpt.html': 'https://chatgpt.com/c/abc123',
  'chatgpt-turn-only.html': 'https://chatgpt.com/c/def456',
  'deepseek.html': 'https://chat.deepseek.com/a/chat/s/9f8e7d6c',
  'doubao.html': 'https://www.doubao.com/chat/1234567890',
  'generic-random.html': 'https://somechat.example.com/t/42',
  'shared-markdown-wrapper.html': 'https://somechat.example.com/t/7',
  'no-role-signals.html': 'https://somechat.example.com/t/8',
  'deepseek-switched.html': 'https://chat.deepseek.com/a/chat/s/9f8e7d6c',
  'two-visible-conversations.html': 'https://somechat.example.com/t/11',
  'deepseek-virtual-real.html': 'https://chat.deepseek.com/share/qwe6aiv9pg6b6b7mbb',
  'deepseek-virtual-stale.html': 'https://chat.deepseek.com/share/rtz1umqpj6sdbj3q4h'
};

export function readFixture(name) {
  return readFileSync(path.join(ROOT, 'tests', 'fixtures', name), 'utf8');
}

export function loadFiles(window, files) {
  for (const file of files) {
    const code = readFileSync(path.join(ROOT, file), 'utf8');
    window.eval(code);
  }
}

export function createEnv(fixtureName, options = {}) {
  const html = options.html != null ? options.html : readFixture(fixtureName);
  const url = options.url || DEFAULT_URLS[fixtureName] || 'https://example.com/chat';
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const locale = options.locale || 'zh-CN';
  Object.defineProperty(dom.window.navigator, 'language', { value: locale, configurable: true });
  Object.defineProperty(dom.window.navigator, 'languages', { value: [locale], configurable: true });
  loadFiles(dom.window, options.files || ALL_FILES);
  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    NS: dom.window.AIChatExporter,
    core: dom.window.AIChatExporter.core,
    platforms: dom.window.AIChatExporter.platforms
  };
}

export function flush(window) {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

/** Minimal PNG bytes used as a fake image payload in tests. */
export function fakePng(size = 24) {
  const bytes = new Uint8Array(size);
  bytes[0] = 0x89;
  bytes[1] = 0x50;
  bytes[2] = 0x4e;
  bytes[3] = 0x47;
  for (let i = 4; i < size; i++) bytes[i] = i % 251;
  return bytes;
}

export function mockFetch(map, { failOn = [] } = {}) {
  return function fetchImpl(url) {
    if (failOn.some((pattern) => String(url).includes(pattern))) {
      return Promise.resolve({ ok: false, status: 404, headers: { get: () => 'text/html' } });
    }
    const bytes = map[url] || fakePng();
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
      arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    });
  };
}
