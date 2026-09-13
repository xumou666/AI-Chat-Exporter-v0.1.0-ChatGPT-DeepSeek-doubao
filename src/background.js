/*
 * AI Chat Exporter — MV3 service worker.
 * The toolbar button opens the on-page panel; on sites that are not covered by
 * the declarative content-script matches the scripts are injected on demand.
 */
'use strict';

const CONTENT_FILES = [
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
  'src/core/app.js',
  'src/platforms/chatgpt.js',
  'src/platforms/deepseek.js',
  'src/platforms/doubao.js',
  'src/platforms/generic.js',
  'src/platforms/index.js',
  'src/ui/panel.js',
  'src/content.js'
];

const PANEL_CSS = 'src/ui/panel.css';

async function openPanel(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'AICE_TOGGLE' });
  } catch (error) {
    return null;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || typeof tab.id !== 'number') return;
  const existing = await openPanel(tab.id);
  if (existing) return;

  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: [PANEL_CSS] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
    await openPanel(tab.id);
  } catch (error) {
    console.warn('[AI Chat Exporter] cannot open panel on this page:', error && error.message);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.info('[AI Chat Exporter] installed. Supported sites: ChatGPT, DeepSeek, 豆包 (plus a generic fallback).');
});
