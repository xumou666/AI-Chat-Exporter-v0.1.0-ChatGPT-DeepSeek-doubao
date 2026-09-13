/*
 * Captures the documentation screenshots with a real Chromium browser
 * (headless), so the images in README/docs always match the current UI.
 *
 *   node tools/make-screenshots.mjs
 *   AICE_BROWSER="/path/to/chrome" node tools/make-screenshots.mjs
 *
 * Nothing is uploaded anywhere: the pages are opened from file:// and written
 * into docs/images/.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'images');

const CANDIDATES = {
  win32: [
    `${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['LOCALAPPDATA']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['ProgramFiles']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge']
};

const SHOTS = [
  {
    name: 'hero.png',
    page: 'demo/ui-preview.html#panel',
    size: [1180, 800],
    scale: 2,
    title: '面板总览（Markdown / JSON / PDF / TXT / HTML）'
  },
  {
    name: 'range-picker.png',
    page: 'demo/ui-preview.html#range=2-4',
    size: [640, 900],
    scale: 2,
    title: '指定范围：序号旁实时显示该条消息的角色与开头'
  },
  {
    name: 'diagnostics.png',
    page: 'demo/ui-preview.html#diag',
    size: [640, 940],
    scale: 2,
    title: '结构诊断：识别策略、候选行、角色置信度、告警'
  },
  {
    name: 'pdf-print.png',
    page: 'examples/chatgpt-print.html',
    size: [900, 1240],
    scale: 2,
    title: 'PDF 导出用的 A4 打印页（另存为 PDF）'
  }
];

function findBrowser() {
  if (process.env.AICE_BROWSER) return process.env.AICE_BROWSER;
  for (const candidate of CANDIDATES[process.platform] || []) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

function capture(browser, shot) {
  const target = path.join(OUT_DIR, shot.name);
  const profile = path.join(os.tmpdir(), `aice-shot-${path.basename(shot.name, '.png')}`);
  rmSync(profile, { recursive: true, force: true });
  // The page string may carry a deep link (#panel / #range=2-4 / #diag) which
  // must stay a URL fragment, never end up in the file path.
  const [pagePath, hash] = shot.page.split('#');
  const url = pathToFileURL(path.join(ROOT, pagePath)).href + (hash ? `#${hash}` : '');
  const args = [
    // New headless renders the very last frame; the legacy one can capture
    // before the panel/deep-link state is applied.
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    `--user-data-dir=${profile}`,
    `--window-size=${shot.size[0]},${shot.size[1]}`,
    `--force-device-scale-factor=${shot.scale}`,
    '--virtual-time-budget=6000',
    `--screenshot=${target}`,
    url
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(browser, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', () => {
      rmSync(profile, { recursive: true, force: true });
      if (!existsSync(target)) {
        reject(new Error(`no screenshot written for ${shot.page}`));
        return;
      }
      resolve({ file: shot.name, bytes: statSync(target).size });
    });
  });
}

const browser = findBrowser();
if (!browser) {
  console.error('No Chrome/Edge/Chromium found. Set AICE_BROWSER=/path/to/browser and retry.');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`browser: ${browser}`);
console.log(`output:  ${path.relative(ROOT, OUT_DIR)}${path.sep}`);

for (const shot of SHOTS) {
  const result = await capture(browser, shot);
  console.log(`  ${result.file.padEnd(20)} ${String(result.bytes).padStart(8)} bytes  — ${shot.title}`);
}
