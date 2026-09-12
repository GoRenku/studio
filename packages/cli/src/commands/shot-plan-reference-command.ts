import type { ImportShotPlanReferenceInput } from '@gorenku/studio-core/client';
import { requiredFlag, type CliCommandHandler } from './structured-command.js';
import type { ShotPlanCommandFlags, ShotPlanCommandRuntime } from './shot-plan-command-handlers.js';

export const shotPlanReferenceCommandHandlers: readonly CliCommandHandler<ShotPlanCommandFlags, ShotPlanCommandRuntime>[] = [
  {
    path: ['reference', 'import'],
    run: ({ flags, runtime }) => runtime.projectDataService.importShotPlanReference({
      projectName: runtime.projectName,
      homeDir: runtime.homeDir,
      shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
      previsRevisionId: flags.previsRevision,
      sourceProjectRelativePath: requiredFlag(flags.source, '--source'),
      mediaKind: requiredFlag(flags.mediaKind, '--media-kind') as ImportShotPlanReferenceInput['mediaKind'],
      title: requiredFlag(flags.title, '--title'),
      summary: flags.summary,
    }),
  },
];
