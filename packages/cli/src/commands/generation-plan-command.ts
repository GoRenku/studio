import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationPlanLine,
  ShotVideoTakeGenerationPlan,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
} from '@gorenku/studio-core/client';
import type { RenkuCliIo } from '../cli.js';
import {
  requiredFlag,
  writeJson,
} from './structured-command.js';

export async function runGenerationPlanCommand(options: {
  input: string[];
  flags: {
    project?: string;
    purpose?: string;
    target?: string;
    model?: string;
    takeGeneration?: string;
    intent?: string;
  };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const purpose = requiredFlag(options.flags.purpose, '--purpose');
  if (purpose !== 'shot.video-take') {
    throw new StructuredError({
      code: 'CLI024',
      message: `Unsupported generation plan purpose: ${purpose}.`,
      suggestion: 'Use --purpose shot.video-take.',
    });
  }
  const service = createProjectDataService();
  const inputModeId = requiredFlag(
    options.flags.intent,
    '--intent'
  ) as ShotVideoTakeInputModeId;
  const modelChoice = requiredFlag(options.flags.model, '--model') as ShotVideoTakeModelChoice;
  const plan = await service.planShotVideoTakeProduction({
    projectName: options.flags.project,
    homeDir: options.homeDir,
    takeGenerationId: requiredFlag(
      options.flags.takeGeneration,
      '--take-generation'
    ),
    production: {
      inputModeId,
      modelChoice,
    },
    inputPolicy: { defaultMode: 'auto' },
  });

  if (options.json) {
    writeJson(options.io, plan);
  } else {
    options.io.stdout.log(formatShotVideoTakePlan(plan));
  }
  return 0;
}

function formatShotVideoTakePlan(plan: ShotVideoTakeGenerationPlan): string {
  const lines = [
    `Plan: ${plan.planId}`,
    `Model: ${plan.model.label}`,
    `Route: ${plan.route.inputMode} -> fal-ai/${plan.route.providerModel}`,
    `Estimate: ${formatEstimate(plan)}`,
    '',
    'Lines:',
    ...plan.lines.map(formatPlanLine),
    '',
    'Dependency checklist:',
    ...plan.dependencyInventory.agentChecklist.map(
      (item) => `  - ${item.action}: ${item.label}`
    ),
  ];
  const missing = plan.lines.filter((line) => line.kind === 'required-attachment');
  if (missing.length > 0) {
    lines.push('', 'Required attachments:', ...missing.map((line) => `  - ${line.label}`));
  }
  const unpriced = plan.lines.filter((line) => line.pricing.state === 'unpriced');
  if (unpriced.length > 0) {
    lines.push(
      '',
      'Unpriced override required:',
      ...unpriced.map((line) => `  - ${line.label}: ${formatUnpricedReason(line)}`)
    );
  }
  if (plan.diagnostics.length > 0) {
    lines.push(
      '',
      'Diagnostics:',
      ...plan.diagnostics.map((diagnostic) => `  - ${diagnostic.code}: ${diagnostic.message}`)
    );
  }
  return lines.join('\n');
}

function formatEstimate(plan: ShotVideoTakeGenerationPlan): string {
  if (plan.estimate.state === 'unavailable') {
    return 'Needs plan';
  }
  const total = formatEstimateTotal(plan);
  if (plan.estimate.state === 'partial') {
    return `${total} + unpriced`;
  }
  return total;
}

function formatPlanLine(line: MediaGenerationPlanLine): string {
  return `  - ${line.label}: ${line.state}, ${formatLinePrice(line)}`;
}

function formatLinePrice(line: MediaGenerationPlanLine): string {
  if (line.pricing.state === 'priced') {
    return `$${line.pricing.estimatedUsd.toFixed(2)}`;
  }
  if (line.pricing.state === 'unpriced') {
    return `unpriced (${line.pricing.reason})`;
  }
  return 'not applicable';
}

function formatEstimateTotal(plan: ShotVideoTakeGenerationPlan): string {
  if (plan.estimate.estimatedTotalUsd === null) {
    return 'unknown';
  }
  return `$${plan.estimate.estimatedTotalUsd.toFixed(2)}`;
}

function formatUnpricedReason(line: MediaGenerationPlanLine): string {
  if (line.pricing.state === 'unpriced') {
    return line.pricing.reason;
  }
  return '';
}
