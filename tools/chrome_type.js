import { typeOnPage } from '../lib/cdp-client.js';

export const name = 'chrome_type';
export const description = 'Type text into a CSS selector in an owned Chrome tab.';
export const parameters = {
  type: 'object',
  properties: {
    targetId: { type: 'string' },
    selector: { type: 'string' },
    text: { type: 'string' },
    submit: { type: 'boolean' }
  },
  required: ['targetId', 'selector', 'text']
};

export async function execute(input, toolCtx) {
  const result = await typeOnPage(toolCtx, input.targetId, input.selector, input.text, !!input.submit);
  return {
    content: [{ type: 'text', text: `Typed into ${input.selector}` }],
    details: result,
  };
}
