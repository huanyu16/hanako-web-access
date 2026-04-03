import fs from 'node:fs';
import path from 'node:path';

export function getProxyPort(ctxLike) {
  return Number(ctxLike?.config?.get?.('proxyPort') ?? process.env.CDP_PROXY_PORT ?? 3456);
}

export function ownedTabsFile(dataDir) {
  return path.join(dataDir, 'owned-tabs.json');
}

export function readOwnedTabs(dataDir) {
  try {
    const file = ownedTabsFile(dataDir);
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

export function writeOwnedTabs(dataDir, data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(ownedTabsFile(dataDir), JSON.stringify(data, null, 2));
}

export function markOwnedTab(dataDir, targetId, meta = {}) {
  const db = readOwnedTabs(dataDir);
  db[targetId] = {
    targetId,
    createdAt: new Date().toISOString(),
    ...meta,
  };
  writeOwnedTabs(dataDir, db);
}

export function unmarkOwnedTab(dataDir, targetId) {
  const db = readOwnedTabs(dataDir);
  delete db[targetId];
  writeOwnedTabs(dataDir, db);
}

export function isOwnedTab(dataDir, targetId) {
  const db = readOwnedTabs(dataDir);
  return !!db[targetId];
}

export function ensureOwnedOrAllowed(ctxLike, dataDir, targetId) {
  const allow = !!ctxLike?.config?.get?.('allowOperateNonOwnedTabs');
  if (allow) return;
  if (!isOwnedTab(dataDir, targetId)) {
    throw new Error(`Refusing to operate non-owned tab: ${targetId}. Open a new tab with hanako-web-access first, or enable allowOperateNonOwnedTabs.`);
  }
}

export async function httpJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.raw || `HTTP ${res.status}`);
  }
  return data;
}

export function summarizeText(text, limit = 6000) {
  const s = String(text ?? '');
  return s.length > limit ? s.slice(0, limit) + '\n...[truncated]' : s;
}
