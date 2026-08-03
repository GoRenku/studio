import type { ScreenplayCommandContext } from './index.js';
import { requiredScreenplayFlag, resolveScreenplayProjectName, unknownScreenplayCommand, writeScreenplayJson } from './index.js';

export async function runScreenplaySceneNumberCommand(context: ScreenplayCommandContext): Promise<number> {
  const [, nested] = context.input;
  if (nested !== 'list' && nested !== 'resolve') {
    throw unknownScreenplayCommand(nested);
  }
  if (nested === 'resolve') {
    requiredScreenplayFlag(context.flags.number, '--number');
  }
  const project = {
    homeDir: context.homeDir,
    projectName: await resolveScreenplayProjectName(context),
  };

  if (nested === 'list') {
    writeScreenplayJson(context.io, await context.service.listSceneProductionNumbers(project));
    return 0;
  }
  if (nested === 'resolve') {
    writeScreenplayJson(context.io, await context.service.resolveSceneProductionNumber({
      ...project,
      productionNumber: context.flags.number!,
    }));
    return 0;
  }
  throw unknownScreenplayCommand(nested);
}
