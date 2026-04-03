import { closeTab } from '../lib/cdp-client.js';

export const name = 'chrome_close_tab';
export const description = 'Close an owned Chrome tab created by this plugin.';
export const parameters = {
  type: 'object',
  properties: {
    targetId: { type: 'string' }
  },
  required: ['targetId']
};

export async function execute(input, toolCtx) {
  const result = await closeTab(toolCtx, input.targetId);
  return {
    content: [{ type: 'text', text: `Closed tab: ${input.targetId}` }],
    details: result,
  };
}
