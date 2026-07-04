import type {
  AgentMediaReport,
} from '../../../client/index.js';
import { readAgentMediaExecutionPolicy } from '../../renku-config.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import {
  type AgentAwareMediaGenerationContextReport,
  type MediaGenerationPurposeContextInput,
  requireMediaGenerationPurposeDefinition,
} from './purpose-lifecycle-registry.js';

export async function buildMediaGenerationContext(
  input: MediaGenerationPurposeContextInput
): Promise<AgentAwareMediaGenerationContextReport> {
  const definition = requireMediaGenerationPurposeDefinition(input.purpose);
  const context = await definition.buildContext(input);
  return decorateAgentMediaReport({
    report: context,
    input,
    mediaKind: definition.mediaKind,
  });
}

export async function buildAgentMediaReport(input: {
  homeDir?: string;
  mediaKind: 'image' | 'audio' | 'video' | 'text' | 'json';
  renkuManagedAvailable?: boolean;
}): Promise<AgentMediaReport> {
  const policy = await readAgentMediaExecutionPolicy({
    homeDir: input.homeDir,
  });
  const appliesToPurpose = input.mediaKind === 'image';
  return {
    imageGeneration: {
      defaultExecutionPath: policy.imageGeneration.defaultExecutionPath,
      appliesToPurpose,
      renkuManagedAvailable:
        appliesToPurpose && (input.renkuManagedAvailable ?? true),
      externalBuiltInGeneration: {
        preferred: appliesToPurpose ? 'codex.gpt-image-2' : null,
        availableInRenku: false,
        requiresHarnessTool: true,
      },
    },
  };
}

export async function decorateAgentMediaReport<Report extends object>(input: {
  report: Report;
  input: RenkuConfigPathOptions;
  mediaKind: 'image' | 'audio' | 'video' | 'text' | 'json';
}): Promise<Report & { agentMedia?: AgentMediaReport }> {
  if (input.mediaKind !== 'image') {
    return input.report;
  }
  return {
    ...input.report,
    agentMedia: await buildAgentMediaReport({
      homeDir: input.input.homeDir,
      mediaKind: input.mediaKind,
      renkuManagedAvailable: true,
    }),
  } as Report & { agentMedia?: AgentMediaReport };
}
