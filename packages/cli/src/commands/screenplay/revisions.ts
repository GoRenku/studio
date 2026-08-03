import type { ScreenplayCommandContext } from './index.js';
import {
  notifyScreenplayMutation,
  requiredScreenplayFlag,
  resolveScreenplayProjectName,
  unknownScreenplayCommand,
  writeScreenplayJson,
} from './index.js';

export async function runScreenplayRevisionCommand(context: ScreenplayCommandContext): Promise<number> {
  const [, nested] = context.input;
  const project = {
    homeDir: context.homeDir,
    projectName: await resolveScreenplayProjectName(context),
  };

  if (nested === 'list') {
    writeScreenplayJson(context.io, await context.service.listScreenplayRevisions(project));
    return 0;
  }
  if (nested === 'show') {
    writeScreenplayJson(context.io, await context.service.readScreenplayRevision({
      ...project,
      revisionId: requiredScreenplayFlag(context.flags.revision, '--revision'),
    }));
    return 0;
  }
  if (nested === 'restore') {
    const report = await context.service.restoreScreenplayRevision({
      ...project,
      revisionId: requiredScreenplayFlag(context.flags.revision, '--revision'),
    });
    await notifyScreenplayMutation(context, report, 'screenplay revision restore');
    writeScreenplayJson(context.io, report);
    return 0;
  }
  throw unknownScreenplayCommand(nested);
}
