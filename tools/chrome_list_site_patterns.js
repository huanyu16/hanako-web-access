import { getSitePatternIndex } from '../lib/cdp-client.js';

export const name = 'chrome_list_site_patterns';
export const description = 'List domains for which site knowledge has been stored.';
export const parameters = { type: 'object', properties: {} };

export async function execute(_input, toolCtx) {
  const items = await getSitePatternIndex(toolCtx);
  return {
    content: [{ type: 'text', text: items.length ? items.map(x => `- ${x}`).join('\n') : 'No stored site patterns yet' }],
    details: { items },
  };
}
