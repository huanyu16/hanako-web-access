import { scrollPage } from '../lib/cdp-client.js';

export const name = 'chrome_scroll';
export const description = 'Scroll an owned Chrome tab to a direction or a specific Y offset.';
export const parameters = {
  type: 'object',
  properties: {
    targetId: { type: 'string' },
    direction: { type: 'string', enum: ['bottom'] },
    y: { type: 'number' }
  },
  required: ['targetId']
};

export async function execute(input, toolCtx) {
  const result = await scrollPage(toolCtx, input.targetId, input.direction, input.y);
  return {
    content: [{ type: 'text', text: 'Scrolled page' }],
    details: result,
  };
}
