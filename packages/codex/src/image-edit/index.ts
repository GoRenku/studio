import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPanelAppResource } from '../panel-sessions/panel-resources.js';
import { imageEditResourceResult } from './diagnostics.js';
import { FLUX_3_IMAGE_EDIT_URI, registerFlux3ImageEditOpening } from './flux-3/open.js';
import { registerImageEditSessionResources } from './resources.js';
import { ImageEditState } from './session-state.js';
import { registerImageEditTargetChoiceTools } from './target-chooser/choice.js';
import { ImageEditTargetChooserState } from './target-chooser/chooser-state.js';
import { IMAGE_EDIT_TARGET_CHOOSER_URI, registerImageEditTargetChooserOpening } from './target-chooser/open.js';
import { registerImageEditTargetChooserResources } from './target-chooser/resources.js';
import { registerImageEditTools } from './tools.js';

export interface ImageEditOptions {
  flux3Html: string;
  targetChooserHtml: string;
  homeDir?: string;
}

export function registerImageEdit(server: McpServer, options: ImageEditOptions): void {
  const sessions = new ImageEditState();
  const choosers = new ImageEditTargetChooserState();
  registerPanelAppResource(server, { uri: FLUX_3_IMAGE_EDIT_URI, title: 'FLUX 3 image edit', file: options.flux3Html, displayMode: 'fullscreen' }, imageEditResourceResult);
  registerPanelAppResource(server, { uri: IMAGE_EDIT_TARGET_CHOOSER_URI, title: 'Choose an image to edit', file: options.targetChooserHtml, displayMode: 'inline' }, imageEditResourceResult);
  registerFlux3ImageEditOpening(server, sessions, options.homeDir);
  registerImageEditTools(server, sessions, options.homeDir);
  registerImageEditSessionResources(server, sessions, options.homeDir);
  registerImageEditTargetChooserOpening(server, choosers, options.homeDir);
  registerImageEditTargetChoiceTools(server, choosers);
  registerImageEditTargetChooserResources(server, choosers, options.homeDir);
  const previousClose = server.server.onclose;
  server.server.onclose = () => {
    previousClose?.();
    sessions.expire();
    choosers.expire();
  };
}
