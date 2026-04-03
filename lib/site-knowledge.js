import fs from 'node:fs';
import path from 'node:path';

function sitePatternsDir(dataDir) {
  return path.join(dataDir, 'site-patterns');
}

function safeDomain(domain) {
  return String(domain || '').trim().toLowerCase().replace(/[^a-z0-9.-]/g, '_');
}

export function domainFromUrl(input) {
  try {
    const u = new URL(input);
    return safeDomain(u.hostname);
  } catch {
    return '';
  }
}

export function sitePatternPath(dataDir, domain) {
  return path.join(sitePatternsDir(dataDir), `${safeDomain(domain)}.md`);
}

export function listSitePatterns(dataDir) {
  const dir = sitePatternsDir(dataDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.md'))
    .map(name => name.replace(/\.md$/, ''))
    .sort();
}

export function readSitePattern(dataDir, domain) {
  const file = sitePatternPath(dataDir, domain);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

function dedupe(arr) {
  return [...new Set((arr || []).map(s => String(s).trim()).filter(Boolean))];
}

function parseSection(body, title) {
  const pattern = new RegExp(`## ${title}\\n([\\s\\S]*?)(?=\\n## |$)`, 'm');
  const m = body.match(pattern);
  if (!m) return [];
  return m[1]
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
    .filter(Boolean);
}

function renderPattern({ domain, aliases = [], updated, facts = [], patterns = [], traps = [] }) {
  return [
    '---',
    `domain: ${domain}`,
    `aliases: [${aliases.map(a => JSON.stringify(a)).join(', ')}]`,
    `updated: ${updated}`,
    '---',
    '',
    '## Platform Facts',
    ...facts.map(x => `- ${x}`),
    '',
    '## Effective Patterns',
    ...patterns.map(x => `- ${x}`),
    '',
    '## Known Traps',
    ...traps.map(x => `- ${x}`),
    '',
  ].join('\n');
}

export function upsertSitePattern(dataDir, domain, patch = {}) {
  const safe = safeDomain(domain);
  if (!safe) return null;
  const existing = readSitePattern(dataDir, safe) || '';
  const current = {
    domain: safe,
    aliases: [],
    updated: new Date().toISOString().slice(0, 10),
    facts: parseSection(existing, 'Platform Facts'),
    patterns: parseSection(existing, 'Effective Patterns'),
    traps: parseSection(existing, 'Known Traps'),
  };
  const next = {
    domain: safe,
    aliases: dedupe([...(current.aliases || []), ...(patch.aliases || [])]),
    updated: new Date().toISOString().slice(0, 10),
    facts: dedupe([...(current.facts || []), ...(patch.facts || [])]),
    patterns: dedupe([...(current.patterns || []), ...(patch.patterns || [])]),
    traps: dedupe([...(current.traps || []), ...(patch.traps || [])]),
  };
  fs.mkdirSync(sitePatternsDir(dataDir), { recursive: true });
  const file = sitePatternPath(dataDir, safe);
  fs.writeFileSync(file, renderPattern(next));
  return { file, domain: safe };
}

export function recordSuccessfulRead(dataDir, { url, title, textLength }) {
  const domain = domainFromUrl(url);
  if (!domain) return null;
  const facts = [
    `[${new Date().toISOString().slice(0, 10)}] Browser CDP read succeeded on ${domain}.`,
  ];
  const patterns = [
    `[${new Date().toISOString().slice(0, 10)}] Open the page in a plugin-owned Chrome tab, then extract visible text from DOM.`
  ];
  if (title) {
    patterns.push(`[${new Date().toISOString().slice(0, 10)}] Example observed page title: ${title}`);
  }
  if (typeof textLength === 'number') {
    facts.push(`[${new Date().toISOString().slice(0, 10)}] Extracted visible text length: ${textLength} characters.`);
  }
  return upsertSitePattern(dataDir, domain, { facts, patterns });
}
