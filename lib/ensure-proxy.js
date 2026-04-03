import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProxyPort, httpJson } from './common.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROXY_SCRIPT = path.join(__dirname, 'proxy', 'cdp-proxy.mjs');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function startProxyDetached(port, log) {
  const logFile = path.join(os.tmpdir(), 'hanako-web-access-proxy.log');
  const fd = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [PROXY_SCRIPT], {
    detached: true,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, CDP_PROXY_PORT: String(port) },
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(fd);
  log?.info?.(`Started CDP proxy on port ${port}. Log: ${logFile}`);
}

export async function ensureProxy(ctxLike) {
  const port = getProxyPort(ctxLike);
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await httpJson(`${base}/health`);
    if (health?.status === 'ok') return { port, base, health };
  } catch {}

  if (ctxLike?.config?.get?.('autoStartProxy') !== false) {
    startProxyDetached(port, ctxLike?.log);
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      try {
        const health = await httpJson(`${base}/health`);
        if (health?.status === 'ok') return { port, base, health };
      } catch {}
    }
  }

  throw new Error('CDP proxy not ready. Ensure Chrome enabled remote debugging at chrome://inspect/#remote-debugging and accepted the authorization prompt.');
}
