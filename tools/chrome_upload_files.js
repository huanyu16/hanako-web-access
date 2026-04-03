import { uploadFiles } from '../lib/cdp-client.js';

export const name = 'chrome_upload_files';
export const description = 'Upload local files into a file input in an owned Chrome tab.';
export const parameters = {
  type: 'object',
  properties: {
    targetId: { type: 'string' },
    selector: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } }
  },
  required: ['targetId', 'selector', 'files']
};

export async function execute(input, toolCtx) {
  const result = await uploadFiles(toolCtx, input.targetId, input.selector, input.files);
  return {
    content: [{ type: 'text', text: `Uploaded ${input.files.length} file(s)` }],
    details: result,
  };
}
