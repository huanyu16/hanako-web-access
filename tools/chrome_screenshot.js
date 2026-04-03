import { screenshotPage } from '../lib/cdp-client.js';

export const name = 'chrome_screenshot';
export const description = 'Capture a screenshot from an owned Chrome tab.';
export const parameters = {
  type: 'object',
  properties: {
    targetId: { type: 'string' },
    filePath: { type: 'string' }
  },
  required: ['targetId']
};

export async function execute(input, toolCtx) {
  const result = await screenshotPage(toolCtx, input.targetId, input.filePath);
  return {
    content: [{ type: 'text', text: `Saved screenshot: ${result.file}` }],
    details: {
      ...result,
      media: { mediaUrls: [result.file] }
    },
  };
}
