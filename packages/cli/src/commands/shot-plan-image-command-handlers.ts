import {
  requiredFlag,
  type CliCommandHandler,
} from './structured-command.js';
import type {
  ShotPlanCommandFlags,
  ShotPlanCommandRuntime,
} from './shot-plan-command-handlers.js';

type Handler = CliCommandHandler<
  ShotPlanCommandFlags,
  ShotPlanCommandRuntime
>;

export const shotPlanImageCommandHandlers: readonly Handler[] = [
  {
    path: ['shot', 'image', 'discard'],
    run: ({ flags, runtime }) =>
      runtime.projectDataService.discardShotImageCandidate({
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
        shotId: requiredFlag(flags.shot, '--shot'),
        assetId: requiredFlag(flags.asset, '--asset'),
      }),
  },
];
