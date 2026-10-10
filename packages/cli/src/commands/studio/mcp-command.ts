import { createRequire } from 'node:module';
import { startCodexServer } from '@gorenku/studio-codex';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { StudioCommandOptions } from './contracts.js';

const require = createRequire(import.meta.url);

export async function runStudioMcpCommand(options: StudioCommandOptions): Promise<number> {
  if (options.input.length !== 1 || options.json) {
    throw new StructuredError({ code: 'CODEX_REVIEW_INVALID', message: 'Usage: renku studio mcp. Stdout is reserved for the MCP protocol.' });
  }
  const manifest = require('../../../package.json') as { version: string };
  const assetFiles = resolveCodexAppAssetFiles();
  await startCodexServer({
    version: manifest.version,
    ...assetFiles,
    homeDir: options.homeDir,
  });
  return 0;
}

function resolveCodexAppAssetFiles() {
  try {
    return {
      generationReviewHtml: require.resolve('@gorenku/studio/codex-apps/generation-review.html'),
      elevenV4DialogueDirectionHtml: require.resolve('@gorenku/studio/codex-apps/eleven-v4-dialogue-direction.html'),
      seedAudioDialogueDirectionHtml: require.resolve('@gorenku/studio/codex-apps/seed-audio-dialogue-direction.html'),
    };
  } catch {
    throw new StructuredError({ code: 'CODEX_REVIEW_UNSUPPORTED', message: 'The packaged Codex app resources are unavailable.', suggestion: 'Build or reinstall the complete Renku Studio runtime before connecting its MCP server.' });
  }
}
