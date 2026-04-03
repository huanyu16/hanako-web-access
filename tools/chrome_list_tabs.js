import { listTabs } from '../lib/cdp-client.js';

export const name = 'chrome_list_tabs';
export const description = 'List current Chrome page targets. Mainly for diagnosis and orientation.';
export const parameters = { type: 'object', properties: {} };

export async function execute(_input, toolCtx) {
  const tabs = await listTabs(toolCtx);
  const text = tabs.map(t => `- ${t.targetId} | ${t.title || ''} | ${t.url || ''}`).join('\n') || 'No tabs';
  return {
    content: [{ type: 'text', text }],
    details: tabs,
  };
}
