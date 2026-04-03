import { clickOnPage } from '../lib/cdp-client.js';

export const name = 'chrome_click';
export const description = 'Click a CSS selector in an owned Chrome tab.';
export const parameters = {
  type: 'object',
  properties: {
    targetId: { type: 'string' },
    selector: { type: 'string' }
  },
  required: ['targetId', 'selector']
};

export async function execute(input, toolCtx) {
  const result = await clickOnPage(toolCtx, input.targetId, input.selector);
  return {
    content: [{ type: 'text', text: `Clicked ${input.selector}` }],
    details: result,
  };
}
