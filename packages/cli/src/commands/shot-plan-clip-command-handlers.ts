import { StructuredError } from '@gorenku/studio-diagnostics';
import { requiredFlag, type CliCommandHandler } from './structured-command.js';
import type { ShotPlanCommandFlags, ShotPlanCommandRuntime } from './shot-plan-command-handlers.js';

const project = (runtime: ShotPlanCommandRuntime) => ({ projectName: runtime.projectName, homeDir: runtime.homeDir });
const scope = (flags: ShotPlanCommandFlags, runtime: ShotPlanCommandRuntime) => ({
  ...project(runtime), shotPlanId: requiredFlag(flags.shotPlan, '--shot-plan'),
  previsRevisionId: requiredFlag(flags.previsRevision, '--previs-revision'),
});

export const shotPlanClipCommandHandlers: readonly CliCommandHandler<ShotPlanCommandFlags, ShotPlanCommandRuntime>[] = [
  { path: ['clip', 'list'], run: ({ flags, runtime }) => runtime.projectDataService.readShotPlanClips(scope(flags, runtime)) },
  { path: ['clip', 'create'], run: ({ flags, runtime }) => runtime.projectDataService.createShotPlanClip(scope(flags, runtime)) },
  { path: ['clip', 'take', 'add'], run: ({ flags, runtime }) => runtime.projectDataService.registerShotPlanClipTake({
    ...project(runtime), clipId: requiredFlag(flags.clip, '--clip'), assetId: requiredFlag(flags.asset, '--asset'),
    assetFileId: requiredFlag(flags.assetFile, '--asset-file'), title: flags.title, sourceTakeId: flags.sourceTake,
  }) },
  { path: ['clip', 'take', 'resolve'], run: ({ flags, runtime }) => {
    const number = requiredFlag(flags.number, '--number');
    const match = /^([1-9]\d*)\.([1-9]\d*)$/.exec(number);
    if (!match) {
      throw new StructuredError({ code: 'CLI_SHOT_PLAN_CLIP_NUMBER_INVALID', message: 'Use a clip.take number such as 1.1.' });
    }
    return runtime.projectDataService.resolveShotPlanClipTake({ ...scope(flags, runtime), clipNumber: Number(match[1]), takeNumber: Number(match[2]) });
  } },
  { path: ['clip', 'take', 'select'], run: ({ flags, runtime }) => runtime.projectDataService.selectShotPlanClipTake({
    ...project(runtime), clipId: requiredFlag(flags.clip, '--clip'), takeId: requiredFlag(flags.take, '--take'),
  }) },
  { path: ['clip', 'take', 'clear'], run: ({ flags, runtime }) => runtime.projectDataService.selectShotPlanClipTake({
    ...project(runtime), clipId: requiredFlag(flags.clip, '--clip'), takeId: null,
  }) },
  { path: ['clip', 'take', 'update'], run: ({ flags, runtime }) => runtime.projectDataService.updateShotPlanClipTake({
    ...project(runtime), takeId: requiredFlag(flags.take, '--take'), title: requiredFlag(flags.title, '--title'),
  }) },
];
