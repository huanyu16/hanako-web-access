import fs from 'node:fs';
import path from 'node:path';
import { ensureProxy } from './lib/ensure-proxy.js';

export default class HanakoWebAccessPlugin {
  async onload() {
    fs.mkdirSync(this.ctx.dataDir, { recursive: true });
    fs.mkdirSync(path.join(this.ctx.dataDir, 'site-patterns'), { recursive: true });

    if (this.ctx.config.get('autoStartProxy') !== false) {
      try {
        await ensureProxy(this.ctx);
        this.ctx.log.info('hanako-web-access proxy ready');
      } catch (err) {
        this.ctx.log.warn(`hanako-web-access proxy not ready on load: ${err?.message || err}`);
      }
    }
  }

  async onunload() {
    // proxy is intentionally left running; reconnect is cheap and avoids repeated Chrome authorization prompts
  }
}
