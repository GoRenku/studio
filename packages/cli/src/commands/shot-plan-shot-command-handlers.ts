import { StructuredError } from '@gorenku/studio-diagnostics';
import type { ShotPlacement } from '@gorenku/studio-core/client';
import {
  requiredFlag,
  type CliCommandHandler,
} from './structured-command.js';
import {
  readShotPlanAuthoringDocument,
  requireDocumentKind,
} from './shot-plan-command-documents.js';
import type {
  ShotPlanCommandFlags,
  ShotPlanCommandRuntime,
} from './shot-plan-command-handlers.js';

type Handler = CliCommandHandler<
  ShotPlanCommandFlags,
  ShotPlanCommandRuntime
>;

export const shotPlanShotCommandHandlers: readonly Handler[] = [
  {
    path: ['shot', 'add'],
    async run({ flags, runtime }) {
      const document = await validatedShotDocument(flags, runtime);
      return runtime.projectDataService.addShotToPlan({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
        shot: document,
        placement: shotPlacement(flags),
      });
    },
  },
  {
    path: ['shot', 'update'],
    async run({ flags, runtime }) {
      const document = await validatedShotDocument(flags, runtime);
      return runtime.projectDataService.updateShotInPlan({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
        shotId: requiredFlag(flags.shot, '--shot'),
        shot: document,
      });
    },
  },
  {
    path: ['shot', 'move'],
    run: ({ flags, runtime }) =>
      runtime.projectDataService.moveShotInPlan({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
        shotId: requiredFlag(flags.shot, '--shot'),
        position: corePosition(flags.position),
      }),
  },
  {
    path: ['shot', 'remove'],
    run: ({ flags, runtime }) =>
      runtime.projectDataService.removeShotFromPlan({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
        shotId: requiredFlag(flags.shot, '--shot'),
      }),
  },
];

async function validatedShotDocument(
  flags: ShotPlanCommandFlags,
  runtime: ShotPlanCommandRuntime
) {
  const validation =
    await runtime.projectDataService.validateShotPlanDocument({
      document: await readShotPlanAuthoringDocument(
        requiredFlag(flags.file, '--file')
      ),
    });
  const { kind: _kind, ...shot } = requireDocumentKind(
    validation.document,
    'shot'
  );
  return shot;
}

export function corePosition(position: number | undefined): number {
  if (
    position === undefined ||
    !Number.isInteger(position) ||
    position < 1
  ) {
    throw new StructuredError({
      code: 'CLI152',
      message: '--position must be a positive one-based integer.',
      suggestion: 'Use --position 1 for the first Shot.',
    });
  }
  return position - 1;
}

export function shotPlacement(flags: ShotPlanCommandFlags): ShotPlacement {
  const placement = flags.placement?.trim() || 'end';
  if (placement === 'start' || placement === 'end') {
    return { position: placement };
  }
  if (placement === 'before' || placement === 'after') {
    return {
      position: placement,
      shotId: requiredFlag(flags.shot, '--shot'),
    };
  }
  throw new StructuredError({
    code: 'CLI153',
    message: '--placement must be start, end, before, or after.',
    suggestion: 'For before or after placement, also pass the anchor with --shot.',
  });
}
