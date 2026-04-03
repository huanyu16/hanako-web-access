import path from 'node:path';
import { ensureProxy } from './ensure-proxy.js';
import { httpJson, markOwnedTab, unmarkOwnedTab, ensureOwnedOrAllowed, summarizeText } from './common.js';
import { domainFromUrl, readSitePattern, recordSuccessfulRead, listSitePatterns } from './site-knowledge.js';

export async function openTab(toolCtx, url = 'about:blank') {
  const { base } = await ensureProxy(toolCtx);
  const result = await httpJson(`${base}/new?url=${encodeURIComponent(url)}`);
  const domain = domainFromUrl(url);
  markOwnedTab(toolCtx.dataDir, result.targetId, { url, domain });
  const knownPattern = domain ? readSitePattern(toolCtx.dataDir, domain) : null;
  return {
    ...result,
    domain,
    knownPattern,
  };
}

export async function listTabs(toolCtx) {
  const { base } = await ensureProxy(toolCtx);
  return httpJson(`${base}/targets`);
}

export async function readPage(toolCtx, targetId) {
  ensureOwnedOrAllowed(toolCtx, toolCtx.dataDir, targetId);
  const { base } = await ensureProxy(toolCtx);
  const info = await httpJson(`${base}/info?target=${encodeURIComponent(targetId)}`);
  const text = await httpJson(`${base}/extractText?target=${encodeURIComponent(targetId)}`);
  const fullText = String(text.text || '');
  const summarized = summarizeText(fullText, 12000);
  const domain = domainFromUrl(info.url);
  const patternWrite = recordSuccessfulRead(toolCtx.dataDir, {
    url: info.url,
    title: info.title,
    textLength: fullText.length,
  });
  const knownPattern = domain ? readSitePattern(toolCtx.dataDir, domain) : null;
  return {
    ...info,
    domain,
    text: summarized,
    fullTextLength: fullText.length,
    knownPattern,
    sitePatternSavedTo: patternWrite?.file || null,
  };
}

export async function evalOnPage(toolCtx, targetId, expression) {
  ensureOwnedOrAllowed(toolCtx, toolCtx.dataDir, targetId);
  const { base } = await ensureProxy(toolCtx);
  return httpJson(`${base}/eval?target=${encodeURIComponent(targetId)}`, {
    method: 'POST',
    body: expression,
  });
}

export async function clickOnPage(toolCtx, targetId, selector) {
  ensureOwnedOrAllowed(toolCtx, toolCtx.dataDir, targetId);
  const { base } = await ensureProxy(toolCtx);
  return httpJson(`${base}/click?target=${encodeURIComponent(targetId)}`, {
    method: 'POST',
    body: selector,
  });
}

export async function typeOnPage(toolCtx, targetId, selector, text, submit = false) {
  ensureOwnedOrAllowed(toolCtx, toolCtx.dataDir, targetId);
  const { base } = await ensureProxy(toolCtx);
  return httpJson(`${base}/type?target=${encodeURIComponent(targetId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selector, text, submit }),
  });
}

export async function scrollPage(toolCtx, targetId, direction, y) {
  ensureOwnedOrAllowed(toolCtx, toolCtx.dataDir, targetId);
  const { base } = await ensureProxy(toolCtx);
  const qs = direction ? `direction=${encodeURIComponent(direction)}` : `y=${encodeURIComponent(y)}`;
  return httpJson(`${base}/scroll?target=${encodeURIComponent(targetId)}&${qs}`);
}

export async function screenshotPage(toolCtx, targetId, filePath) {
  ensureOwnedOrAllowed(toolCtx, toolCtx.dataDir, targetId);
  const { base } = await ensureProxy(toolCtx);
  const finalPath = filePath || path.join(toolCtx.dataDir, `shot-${Date.now()}.png`);
  return httpJson(`${base}/screenshot?target=${encodeURIComponent(targetId)}&file=${encodeURIComponent(finalPath)}`);
}

export async function uploadFiles(toolCtx, targetId, selector, files) {
  ensureOwnedOrAllowed(toolCtx, toolCtx.dataDir, targetId);
  const { base } = await ensureProxy(toolCtx);
  return httpJson(`${base}/setFiles?target=${encodeURIComponent(targetId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selector, files }),
  });
}

export async function closeTab(toolCtx, targetId) {
  ensureOwnedOrAllowed(toolCtx, toolCtx.dataDir, targetId);
  const { base } = await ensureProxy(toolCtx);
  const result = await httpJson(`${base}/close?target=${encodeURIComponent(targetId)}`);
  unmarkOwnedTab(toolCtx.dataDir, targetId);
  return result;
}

export async function getSitePattern(toolCtx, domainOrUrl) {
  const domain = domainFromUrl(domainOrUrl) || domainOrUrl;
  const content = readSitePattern(toolCtx.dataDir, domain);
  return {
    domain,
    content,
  };
}

export async function getSitePatternIndex(toolCtx) {
  return listSitePatterns(toolCtx.dataDir);
}
