/*
 * Documentation tests — every relative image/link in the docs must point at a
 * file that actually ships, otherwise a GitHub README renders broken.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/env.mjs';

const DOCS = ['README.md', 'docs/使用教程.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'PRIVACY.md'];

function readDoc(file) {
  return readFileSync(path.join(ROOT, file), 'utf8');
}

function isRelative(target) {
  return target && !/^(https?:|mailto:|#|\/)/i.test(target);
}

function collectTargets(markdown) {
  const targets = [];
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
    targets.push({ target: match[1], kind: 'link' });
  }
  for (const match of markdown.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    targets.push({ target: match[1], kind: 'image' });
  }
  return targets;
}

test('every relative link and image in the docs exists', () => {
  const problems = [];
  for (const file of DOCS) {
    assert.ok(existsSync(path.join(ROOT, file)), `missing doc: ${file}`);
    const base = path.dirname(path.join(ROOT, file));
    for (const { target, kind } of collectTargets(readDoc(file))) {
      const clean = target.split('#')[0];
      if (!isRelative(clean)) continue;
      if (!existsSync(path.join(base, clean))) problems.push(`${file} → ${kind} not found: ${target}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('the README shows the documented screenshots', () => {
  const readme = readDoc('README.md');
  for (const image of ['hero.png', 'range-picker.png', 'diagnostics.png', 'pdf-print.png']) {
    assert.ok(readme.includes(`docs/images/${image}`), `README must show docs/images/${image}`);
    assert.ok(existsSync(path.join(ROOT, 'docs', 'images', image)), `missing screenshot: ${image}`);
  }
});

test('the README points at the tutorial, changelog and contributing guide', () => {
  const readme = readDoc('README.md');
  for (const doc of ['docs/使用教程.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'PRIVACY.md', 'LICENSE']) {
    assert.ok(existsSync(path.join(ROOT, doc)), `missing ${doc}`);
  }
  assert.ok(readme.includes('docs/使用教程.md'), 'README must link the Chinese tutorial');
});

test('the tutorial covers the features that exist in the panel', () => {
  const tutorial = readDoc('docs/使用教程.md');
  for (const topic of [
    '导出范围',        // partial export
    '包含图片',        // image packaging
    '另存为 PDF',      // pdf path
    '手动校准',        // calibration
    '结构诊断',        // diagnostics
    '文件名模板',      // filename template
    'chrome://extensions'
  ]) {
    assert.ok(tutorial.includes(topic), `tutorial is missing: ${topic}`);
  }
  // The partial-export preview is the newest feature and must be described.
  assert.match(tutorial, /序号旁.*显示/, 'tutorial must explain the ordinal preview');
});

test('badges use static shields so they render without a repo url', () => {
  const readme = readDoc('README.md');
  const badges = readme.match(/https:\/\/img\.shields\.io\/[^\s)]+/g) || [];
  assert.ok(badges.length >= 3, 'expected a few badges');
  for (const badge of badges) {
    assert.ok(!badge.includes('<'), `badge contains a placeholder: ${badge}`);
  }
});
