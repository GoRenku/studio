import { createRequire } from 'node:module';
import { startCodexServer } from '@gorenku/studio-codex';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { StudioCommandOptions } from './contracts.js';
import { createGenerationCostEstimator } from '../generation/cost-estimator.js';

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
    costEstimator: createGenerationCostEstimator(),
    homeDir: options.homeDir,
  });
  return 0;
}

function resolveCodexAppAssetFiles() {
  try {
    return {
      generationReviewHtml: require.resolve('@gorenku/studio/codex-apps/generation-review.html'),
      dialogueDirectionHtml: require.resolve('@gorenku/studio/codex-apps/dialogue-direction.html'),
      imageEditHtml: require.resolve('@gorenku/studio/codex-apps/image-edit.html'),
      imageEditTargetChooserHtml: require.resolve('@gorenku/studio/codex-apps/image-edit-target-chooser.html'),
      routeChooserHtml: require.resolve('@gorenku/studio/codex-apps/route-chooser.html'),
      castingRoundHtml: require.resolve('@gorenku/studio/codex-apps/casting-round.html'),
      castingBoardHtml: require.resolve('@gorenku/studio/codex-apps/casting-board.html'),
      castingWardrobeHtml: require.resolve('@gorenku/studio/codex-apps/casting-wardrobe.html'),
    };
  } catch {
    throw new StructuredError({ code: 'CODEX_REVIEW_UNSUPPORTED', message: 'The packaged Codex app resources are unavailable.', suggestion: 'Build or reinstall the complete Renku Studio runtime before connecting its MCP server.' });
  }
}
