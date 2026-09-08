import type { RegisterShotPlanPrevisInput } from '@gorenku/studio-core/client';
import { readJsonFile, requiredFlag, type CliCommandHandler } from './structured-command.js';
import type { ShotPlanCommandFlags, ShotPlanCommandRuntime } from './shot-plan-command-handlers.js';

export const shotPlanPrevisCommandHandlers: readonly CliCommandHandler<ShotPlanCommandFlags, ShotPlanCommandRuntime>[] = [
  {
    path: ['previs', 'show'],
    run: ({ flags, runtime }) => runtime.projectDataService.readShotPlanPrevis({
      projectName: runtime.projectName,
      homeDir: runtime.homeDir,
      shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
    }),
  },
  {
    path: ['previs', 'register'],
    async run({ flags, runtime }) {
      const document = await readJsonFile(requiredFlag(flags.file, '--file')) as RegisterShotPlanPrevisInput | null;
      return runtime.projectDataService.registerShotPlanPrevis({
        sourceDirectory: document?.sourceDirectory as string,
        renderPath: document?.renderPath as string,
        title: document?.title,
        projectName: runtime.projectName,
        homeDir: runtime.homeDir,
        shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
      });
    },
  },
];
