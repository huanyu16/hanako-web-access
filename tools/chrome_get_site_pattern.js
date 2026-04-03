import { getSitePattern } from '../lib/cdp-client.js';

export const name = 'chrome_get_site_pattern';
export const description = 'Read stored site knowledge for a domain or URL gathered from prior successful browser runs.';
export const parameters = {
  type: 'object',
  properties: {
    domainOrUrl: { type: 'string', description: 'Domain like example.com or a full URL' }
  },
  required: ['domainOrUrl']
};

export async function execute(input, toolCtx) {
  const result = await getSitePattern(toolCtx, input.domainOrUrl);
  return {
    content: [{ type: 'text', text: result.content || `No stored site pattern for ${result.domain}` }],
    details: result,
  };
}
