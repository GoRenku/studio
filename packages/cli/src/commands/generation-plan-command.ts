import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationPlanLine,
  ShotVideoTakeGenerationPlan,
  ShotVideoTakeIntentId,
  ShotVideoTakeModelChoice,
} from '@gorenku/studio-core/client';
import type { RenkuCliIo } from '../cli.js';

export async function runGenerationPlanCommand(options: {
  input: string[];
  flags: {
    project?: string;
    purpose?: string;
    target?: string;
    model?: string;
    shotList?: string;
    shots?: string;
    productionGroup?: string;
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
  const target = requiredFlag(options.flags.target, '--target');
  const intent = requiredFlag(options.flags.intent, '--intent') as ShotVideoTakeIntentId;
  const modelChoice = requiredFlag(options.flags.model, '--model') as ShotVideoTakeModelChoice;
  const plan = await service.planShotVideoTakeProduction({
    projectName: options.flags.project,
    homeDir: options.homeDir,
    sceneId: parseSceneTarget(target),
    shotListId: requiredFlag(options.flags.shotList, '--shot-list'),
    shotIds: parseShots(requiredFlag(options.flags.shots, '--shots')),
    productionGroupId: requiredFlag(options.flags.productionGroup, '--production-group'),
    production: {
      intentId: intent,
      modelChoice,
    },
    inputPolicy: { defaultMode: 'auto' },
  });

  if (options.json) {
    options.io.stdout.log(JSON.stringify(plan, null, 2));
  } else {
    options.io.stdout.log(formatShotVideoTakePlan(plan));
  }
  return 0;
}

function formatShotVideoTakePlan(plan: ShotVideoTakeGenerationPlan): string {
  const lines = [
    `Plan: ${plan.planId}`,
    `Model: ${plan.model.label}`,
    `Route: ${plan.route.intent} -> fal-ai/${plan.route.providerModel}`,
    `Estimate: ${formatEstimate(plan)}`,
    '',
    'Lines:',
    ...plan.lines.map(formatPlanLine),
    '',
    'Execution levels:',
    ...plan.dependencyMap.execution.levels.map(
      (level, index) => `  ${index + 1}. ${level.join(', ')}`
    ),
  ];
  const missing = plan.lines.filter((line) => line.kind === 'required-attachment');
  if (missing.length > 0) {
    lines.push('', 'Required attachments:', ...missing.map((line) => `  - ${line.label}`));
  }
  const unpriced = plan.lines.filter((line) => line.pricing.state === 'unpriced');
  if (unpriced.length > 0) {
    lines.push('', 'Unpriced override required:', ...unpriced.map((line) => `  - ${line.label}: ${line.pricing.state === 'unpriced' ? line.pricing.reason : ''}`));
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
  const total = plan.estimate.estimatedTotalUsd === null
    ? 'unknown'
    : `$${plan.estimate.estimatedTotalUsd.toFixed(2)}`;
  return plan.estimate.state === 'partial' ? `${total} + unpriced` : total;
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

function parseSceneTarget(value: string): string {
  const [kind, id, extra] = value.split(':');
  if (kind !== 'scene' || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `Shot video take plan target must use scene:<id>. Received: ${value}.`,
      suggestion: 'Use --target scene:<scene-id>.',
    });
  }
  return id;
}

function parseShots(value: string): string[] {
  const shots = value
    .split(',')
    .map((shotId) => shotId.trim())
    .filter(Boolean);
  if (shots.length === 0) {
    throw new StructuredError({
      code: 'CLI030',
      message: '--shots must include at least one shot id.',
      suggestion: 'Use --shots shot_001 or --shots shot_001,shot_002.',
    });
  }
  return shots;
}

function requiredFlag(value: string | undefined, flag: string): string {
  if (!value) {
    throw new StructuredError({
      code: 'CLI001',
      message: `Missing required flag: ${flag}.`,
    });
  }
  return value;
}
