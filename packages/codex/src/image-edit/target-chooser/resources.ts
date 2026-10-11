import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readPanelMedia } from '../../panel-sessions/media-registry.js';
import { imageEditError, imageEditResourceResult } from '../diagnostics.js';
import { IMAGE_EDIT_TARGET_MEDIA_SCHEME, type ImageEditTargetChooserState } from './chooser-state.js';

export function registerImageEditTargetChooserResources(server: McpServer, state: ImageEditTargetChooserState, homeDir?: string): void {
  server.registerResource('Image edit chooser', new ResourceTemplate(`${IMAGE_EDIT_TARGET_MEDIA_SCHEME}://{chooserId}`, { list: undefined }), { mimeType: 'application/json' }, (uri, variables) => imageEditResourceResult(async () => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(state.chooser(String(variables.chooserId))) }],
  })));
  server.registerResource('Image edit chooser media', new ResourceTemplate(`${IMAGE_EDIT_TARGET_MEDIA_SCHEME}://{chooserId}/media/{mediaId}`, { list: undefined }), {}, (uri) => imageEditResourceResult(() => readPanelMedia({
    uri: uri.href,
    scheme: IMAGE_EDIT_TARGET_MEDIA_SCHEME,
    source: (chooserId) => {
      const record = state.record(chooserId);
      return { projectRef: record.projectRef, media: record.media };
    },
    notFound: () => imageEditError('CODEX_IMAGE_EDIT_NOT_FOUND', 'This chooser image is not available.'),
    homeDir,
  })));
}
