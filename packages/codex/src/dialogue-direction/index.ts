import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ELEVEN_V4_DIALOGUE_DIRECTION_URI, registerElevenV4DialogueDirectionOpening } from './eleven-v4/open.js';
import { registerDirectionPanelResource, registerDirectionSessionResources } from './resources.js';
import { registerSeedAudioDialogueDirectionOpening, SEED_AUDIO_DIALOGUE_DIRECTION_URI } from './seed-audio/open.js';
import { DialogueDirectionState } from './session-state.js';
import { registerDirectionTools } from './tools.js';

export interface DialogueDirectionOptions {
  elevenV4Html: string;
  seedAudioHtml: string;
  homeDir?: string;
}

export function registerDialogueDirection(server: McpServer, options: DialogueDirectionOptions): void {
  const state = new DialogueDirectionState();
  registerDirectionPanelResource(server, ELEVEN_V4_DIALOGUE_DIRECTION_URI, 'Eleven v4 dialogue direction', options.elevenV4Html);
  registerDirectionPanelResource(server, SEED_AUDIO_DIALOGUE_DIRECTION_URI, 'Seed Audio dialogue direction', options.seedAudioHtml);
  registerElevenV4DialogueDirectionOpening(server, state, options.homeDir);
  registerSeedAudioDialogueDirectionOpening(server, state, options.homeDir);
  registerDirectionTools(server, state, options.homeDir);
  registerDirectionSessionResources(server, state, options.homeDir);
  const previousClose = server.server.onclose;
  server.server.onclose = () => {
    previousClose?.();
    state.expire();
  };
}
