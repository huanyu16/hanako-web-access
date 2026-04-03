import { evalOnPage } from '../lib/cdp-client.js';

export const name = 'chrome_eval';
export const description = 'Execute JavaScript in an owned Chrome tab. Use carefully for DOM inspection and structured extraction.';
export const parameters = {
  type: 'object',
  properties: {
    targetId: { type: 'string' },
    expression: { type: 'string', description: 'JavaScript expression' }
  },
  required: ['targetId', 'expression']
};

export async function execute(input, toolCtx) {
  const result = await evalOnPage(toolCtx, input.targetId, input.expression);
  return {
    content: [{ type: 'text', text: JSON.stringify(result.value ?? result, null, 2) }],
    details: result,
  };
}
