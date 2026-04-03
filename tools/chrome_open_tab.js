import { openTab } from '../lib/cdp-client.js';

export const name = 'chrome_open_tab';
export const description = 'Open a new background tab in the user\'s Chrome via CDP. Use for sites requiring login, JS rendering, or interaction.';
export const parameters = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to open' }
  },
  required: ['url']
};

export async function execute(input, toolCtx) {
  const result = await openTab(toolCtx, input.url);
  return {
    content: [{ type: 'text', text: `Opened Chrome tab: ${result.targetId}` }],
    details: result,
  };
}
