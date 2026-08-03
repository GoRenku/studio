import type { ScreenplayCommandContext } from './index.js';
import { requiredScreenplayFlag, resolveScreenplayProjectName, unknownScreenplayCommand, writeScreenplayJson } from './index.js';

export async function runScreenplayReadingCommand(context: ScreenplayCommandContext): Promise<number> {
  const [subcommand, nested, id] = context.input;
  const project = {
    homeDir: context.homeDir,
    projectName: await resolveScreenplayProjectName(context),
  };

  if (subcommand === 'status') {
    writeScreenplayJson(context.io, await context.service.readScreenplayStatus(project));
    return 0;
  }
  if (subcommand === 'show') {
    const resource = await context.service.readScreenplayStructure(project);
    writeScreenplayJson(context.io, resource.screenplay);
    return 0;
  }
  if (subcommand === 'structure') {
    writeScreenplayJson(context.io, await context.service.readScreenplayStructure(project));
    return 0;
  }
  if (subcommand === 'section' && nested === 'show') {
    writeScreenplayJson(context.io, await context.service.readScreenplaySection({
      ...project,
      sectionId: requiredScreenplayFlag(id, 'section ID'),
    }));
    return 0;
  }
  if (subcommand === 'scene' && nested === 'show') {
    writeScreenplayJson(context.io, await context.service.readScreenplayScene({
      ...project,
      sceneId: requiredScreenplayFlag(id ?? context.flags.scene, 'scene ID'),
    }));
    return 0;
  }
  throw unknownScreenplayCommand(subcommand);
}
