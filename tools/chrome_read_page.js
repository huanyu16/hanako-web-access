import { readPage } from '../lib/cdp-client.js';

export const name = 'chrome_read_page';
export const description = 'Read the current page text from an owned Chrome tab. Preferred over screenshots when text content is needed.';
export const parameters = {
  type: 'object',
  properties: {
    targetId: { type: 'string', description: 'Chrome target id returned by chrome_open_tab' }
  },
  required: ['targetId']
};

export async function execute(input, toolCtx) {
  const result = await readPage(toolCtx, input.targetId);
  const text = [`Title: ${result.title || ''}`, `URL: ${result.url || ''}`, '', result.text || ''].join('\n');
  return {
    content: [{ type: 'text', text }],
    details: result,
  };
}
