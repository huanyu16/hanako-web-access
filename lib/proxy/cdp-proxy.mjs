#!/usr/bin/env node
import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';

const PORT = parseInt(process.env.CDP_PROXY_PORT || '3456');
let ws = null;
let cmdId = 0;
const pending = new Map();
const sessions = new Map();

let WS;
if (typeof globalThis.WebSocket !== 'undefined') {
  WS = globalThis.WebSocket;
} else {
  try {
    WS = (await import('ws')).default;
  } catch {
    console.error('[hanako-web-access] Node.js 22+ required, or install ws globally');
    process.exit(1);
  }
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, '127.0.0.1');
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, 1500);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.once('error', () => { clearTimeout(timer); resolve(false); });
  });
}

async function discoverChromePort() {
  const possiblePaths = [];
  const platform = os.platform();
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || '';
  if (platform === 'darwin') {
    possiblePaths.push(
      path.join(home, 'Library/Application Support/Google/Chrome/DevToolsActivePort'),
      path.join(home, 'Library/Application Support/Google/Chrome Canary/DevToolsActivePort'),
      path.join(home, 'Library/Application Support/Chromium/DevToolsActivePort'),
    );
  } else if (platform === 'linux') {
    possiblePaths.push(
      path.join(home, '.config/google-chrome/DevToolsActivePort'),
      path.join(home, '.config/chromium/DevToolsActivePort'),
    );
  } else if (platform === 'win32') {
    possiblePaths.push(
      path.join(localAppData, 'Google/Chrome/User Data/DevToolsActivePort'),
      path.join(localAppData, 'Chromium/User Data/DevToolsActivePort'),
    );
  }

  for (const p of possiblePaths) {
    try {
      const lines = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/);
      const port = parseInt(lines[0], 10);
      if (port > 0 && await checkPort(port)) {
        return { port, wsPath: lines[1] || null };
      }
    } catch {}
  }

  for (const port of [9222, 9229, 9333]) {
    if (await checkPort(port)) return { port, wsPath: null };
  }
  return null;
}

let chromePort = null;
let chromeWsPath = null;
let connectingPromise = null;

function getWebSocketUrl(port, wsPath) {
  return wsPath ? `ws://127.0.0.1:${port}${wsPath}` : `ws://127.0.0.1:${port}/devtools/browser`;
}

async function connect() {
  if (ws && (ws.readyState === WS.OPEN || ws.readyState === 1)) return;
  if (connectingPromise) return connectingPromise;

  if (!chromePort) {
    const found = await discoverChromePort();
    if (!found) throw new Error('Chrome remote debugging not detected. Open chrome://inspect/#remote-debugging and allow remote debugging for this browser instance.');
    chromePort = found.port;
    chromeWsPath = found.wsPath;
  }

  return connectingPromise = new Promise((resolve, reject) => {
    ws = new WS(getWebSocketUrl(chromePort, chromeWsPath));

    const onOpen = () => {
      cleanup();
      connectingPromise = null;
      resolve();
    };
    const onError = (e) => {
      cleanup();
      connectingPromise = null;
      ws = null;
      chromePort = null;
      chromeWsPath = null;
      reject(new Error(e?.message || 'WebSocket connect failed'));
    };
    const onClose = () => {
      ws = null;
      chromePort = null;
      chromeWsPath = null;
      sessions.clear();
    };
    const onMessage = (evt) => {
      const raw = typeof evt === 'string' ? evt : (evt.data || evt);
      const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
      if (msg.method === 'Target.attachedToTarget') {
        const { sessionId, targetInfo } = msg.params;
        sessions.set(targetInfo.targetId, sessionId);
      }
      if (msg.id && pending.has(msg.id)) {
        const { resolve, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        resolve(msg);
      }
    };
    function cleanup() {
      ws.removeEventListener?.('open', onOpen);
      ws.removeEventListener?.('error', onError);
    }
    if (ws.on) {
      ws.on('open', onOpen);
      ws.on('error', onError);
      ws.on('close', onClose);
      ws.on('message', onMessage);
    } else {
      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
      ws.addEventListener('close', onClose);
      ws.addEventListener('message', onMessage);
    }
  });
}

function sendCDP(method, params = {}, sessionId = null) {
  return new Promise((resolve, reject) => {
    if (!ws || (ws.readyState !== WS.OPEN && ws.readyState !== 1)) {
      reject(new Error('WebSocket not connected'));
      return;
    }
    const id = ++cmdId;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 30000);
    pending.set(id, { resolve, timer });
    ws.send(JSON.stringify(msg));
  });
}

async function ensureSession(targetId) {
  if (sessions.has(targetId)) return sessions.get(targetId);
  const resp = await sendCDP('Target.attachToTarget', { targetId, flatten: true });
  const sid = resp?.result?.sessionId;
  if (!sid) throw new Error('Failed to attach target');
  sessions.set(targetId, sid);
  return sid;
}

async function waitForLoad(sessionId, timeoutMs = 15000) {
  await sendCDP('Page.enable', {}, sessionId);
  return new Promise((resolve) => {
    let done = false;
    const finish = (reason) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(tick);
      resolve(reason);
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    const tick = setInterval(async () => {
      try {
        const resp = await sendCDP('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sessionId);
        if (resp?.result?.result?.value === 'complete') finish('complete');
      } catch {}
    }, 400);
  });
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

async function evalExpr(targetId, expr) {
  const sid = await ensureSession(targetId);
  const resp = await sendCDP('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  }, sid);
  if (resp.result?.exceptionDetails) {
    throw new Error(resp.result.exceptionDetails.text || 'Eval failed');
  }
  return resp.result?.result?.value ?? resp.result;
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = parsed.pathname;
  const q = Object.fromEntries(parsed.searchParams);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    if (pathname === '/health') {
      res.end(JSON.stringify({ status: 'ok', connected: !!ws, sessions: sessions.size, chromePort }));
      return;
    }

    await connect();

    if (pathname === '/targets') {
      const resp = await sendCDP('Target.getTargets');
      const pages = (resp.result?.targetInfos || []).filter(t => t.type === 'page');
      res.end(JSON.stringify(pages, null, 2));
      return;
    }

    if (pathname === '/new') {
      const targetUrl = q.url || 'about:blank';
      const resp = await sendCDP('Target.createTarget', { url: targetUrl, background: true });
      const targetId = resp.result.targetId;
      if (targetUrl !== 'about:blank') {
        try {
          const sid = await ensureSession(targetId);
          await waitForLoad(sid);
        } catch {}
      }
      res.end(JSON.stringify({ targetId }));
      return;
    }

    if (pathname === '/close') {
      const resp = await sendCDP('Target.closeTarget', { targetId: q.target });
      sessions.delete(q.target);
      res.end(JSON.stringify(resp.result || { success: true }));
      return;
    }

    if (pathname === '/info') {
      const sid = await ensureSession(q.target);
      const title = await evalExpr(q.target, 'document.title');
      const url = await evalExpr(q.target, 'location.href');
      const readyState = await sendCDP('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sid);
      res.end(JSON.stringify({ title, url, readyState: readyState?.result?.result?.value }));
      return;
    }

    if (pathname === '/navigate') {
      const sid = await ensureSession(q.target);
      const resp = await sendCDP('Page.navigate', { url: q.url }, sid);
      await waitForLoad(sid);
      res.end(JSON.stringify(resp.result || { ok: true }));
      return;
    }

    if (pathname === '/back') {
      const sid = await ensureSession(q.target);
      await sendCDP('Runtime.evaluate', { expression: 'history.back()' }, sid);
      await waitForLoad(sid);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (pathname === '/eval') {
      const body = await readBody(req);
      const value = await evalExpr(q.target, body || q.expr || 'document.title');
      res.end(JSON.stringify({ value }));
      return;
    }

    if (pathname === '/extractText') {
      const expr = String.raw`(() => {
        const body = document.body;
        if (!body) return { title: document.title, url: location.href, text: '' };
        const text = (body.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
        return { title: document.title, url: location.href, text };
      })()`;
      const value = await evalExpr(q.target, expr);
      res.end(JSON.stringify(value));
      return;
    }

    if (pathname === '/click') {
      const sid = await ensureSession(q.target);
      const selector = await readBody(req);
      const js = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'Element not found' };
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { clicked: true, tag: el.tagName, text: (el.textContent || '').slice(0, 120) };
      })()`;
      const resp = await sendCDP('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true }, sid);
      const value = resp.result?.result?.value;
      if (value?.error) throw new Error(value.error);
      res.end(JSON.stringify(value || { clicked: true }));
      return;
    }

    if (pathname === '/type') {
      const sid = await ensureSession(q.target);
      const body = JSON.parse(await readBody(req) || '{}');
      const { selector, text = '', submit = false } = body;
      const js = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { error: 'Element not found' };
        el.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(text)}); else el.value = ${JSON.stringify(text)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (${submit ? 'true' : 'false'}) {
          const form = el.form;
          if (form) form.requestSubmit?.();
          else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
        return { typed: true, length: (${JSON.stringify(text)}).length };
      })()`;
      const resp = await sendCDP('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true }, sid);
      const value = resp.result?.result?.value;
      if (value?.error) throw new Error(value.error);
      res.end(JSON.stringify(value || { typed: true }));
      return;
    }

    if (pathname === '/scroll') {
      const sid = await ensureSession(q.target);
      const y = q.y ? Number(q.y) : null;
      const direction = q.direction || null;
      let expr = 'window.scrollBy(0, 800); ({ ok: true })';
      if (Number.isFinite(y)) expr = `window.scrollTo(0, ${y}); ({ ok: true, y: ${y} })`;
      if (direction === 'bottom') expr = 'window.scrollTo(0, document.body.scrollHeight); ({ ok: true, direction: "bottom" })';
      const resp = await sendCDP('Runtime.evaluate', { expression: expr, returnByValue: true }, sid);
      res.end(JSON.stringify(resp.result?.result?.value || { ok: true }));
      return;
    }

    if (pathname === '/setFiles') {
      const sid = await ensureSession(q.target);
      const body = JSON.parse(await readBody(req) || '{}');
      const { selector, files = [] } = body;
      const doc = await sendCDP('DOM.getDocument', {}, sid);
      const rootId = doc.result.root.nodeId;
      const query = await sendCDP('DOM.querySelector', { nodeId: rootId, selector }, sid);
      const nodeId = query.result.nodeId;
      if (!nodeId) throw new Error('File input not found');
      const backend = await sendCDP('DOM.describeNode', { nodeId }, sid);
      await sendCDP('DOM.setFileInputFiles', { files, backendNodeId: backend.result.node.backendNodeId }, sid);
      res.end(JSON.stringify({ ok: true, files }));
      return;
    }

    if (pathname === '/screenshot') {
      const sid = await ensureSession(q.target);
      await sendCDP('Page.enable', {}, sid);
      const shot = await sendCDP('Page.captureScreenshot', { format: 'png', fromSurface: true }, sid);
      const file = q.file || path.join(os.tmpdir(), `hanako-shot-${Date.now()}.png`);
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      res.end(JSON.stringify({ ok: true, file }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err?.message || String(err) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[hanako-web-access] proxy listening on ${PORT}`);
});
