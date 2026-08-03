import type {
  SceneBeatSheetDocument,
  SceneBeatSheetOperationDocument,
} from '@gorenku/studio-core/server';
import { readScreenplayJsonInput } from './authoring.js';
import type { ScreenplayCommandContext } from './index.js';
import {
  notifyScreenplayMutation,
  requiredScreenplayFlag,
  unknownScreenplayCommand,
  writeScreenplayJson,
} from './index.js';

export async function runScreenplayBeatSheetCommand(context: ScreenplayCommandContext): Promise<number> {
  const [, nested, id] = context.input;
  const project = { homeDir: context.homeDir, projectName: context.flags.project };

  if (nested === 'context') {
    writeScreenplayJson(context.io, await context.service.readSceneBeatSheetContext({
      ...project,
      sceneId: requiredScreenplayFlag(context.flags.scene, '--scene'),
      includeVisualReferences: context.flags.includeVisualReferences,
    }));
    return 0;
  }
  if (nested === 'list') {
    writeScreenplayJson(context.io, await context.service.listSceneBeatSheets({
      ...project,
      sceneId: requiredScreenplayFlag(context.flags.scene, '--scene'),
    }));
    return 0;
  }
  if (nested === 'show') {
    writeScreenplayJson(context.io, await context.service.readSceneBeatSheet({
      ...project,
      active: context.flags.active,
      sceneId: context.flags.scene,
      beatSheetId: context.flags.beatSheet,
    }));
    return 0;
  }
  if (nested === 'storyboard' && id === 'status') {
    writeScreenplayJson(context.io, await context.service.readSceneBeatSheetStoryboardStatus({
      ...project,
      sceneId: requiredScreenplayFlag(context.flags.scene, '--scene'),
      beatSheetId: requiredScreenplayFlag(context.flags.beatSheet, '--beat-sheet'),
    }));
    return 0;
  }
  if (nested === 'validate' || nested === 'write') {
    const filePath = requiredScreenplayFlag(context.flags.file, '--file');
    const document = await readScreenplayJsonInput(filePath) as SceneBeatSheetDocument;
    const report = nested === 'validate'
      ? await context.service.validateSceneBeatSheet({
          ...project,
          document,
          filePath: filePath !== '-' ? filePath : undefined,
        })
      : await context.service.writeSceneBeatSheet({
          ...project,
          document,
          filePath: filePath !== '-' ? filePath : undefined,
        });
    if (nested === 'write') {
      await notifyScreenplayMutation(context, report, 'screenplay beat-sheet write');
    }
    writeScreenplayJson(context.io, report);
    return 0;
  }
  if (nested === 'validate-operations' || nested === 'apply') {
    const filePath = requiredScreenplayFlag(context.flags.file, '--file');
    const document = await readScreenplayJsonInput(filePath) as SceneBeatSheetOperationDocument;
    const report = nested === 'validate-operations'
      ? await context.service.validateSceneBeatSheetOperations({
          ...project,
          document,
          filePath: filePath !== '-' ? filePath : undefined,
        })
      : await context.service.applySceneBeatSheetOperations({
          ...project,
          document,
          filePath: filePath !== '-' ? filePath : undefined,
          dryRun: context.flags.dryRun,
        });
    if (nested === 'apply' && !context.flags.dryRun) {
      await notifyScreenplayMutation(context, report, 'screenplay beat-sheet apply');
    }
    writeScreenplayJson(context.io, report);
    return 0;
  }
  if (nested === 'set-active') {
    const report = await context.service.setActiveSceneBeatSheet({
      ...project,
      sceneId: requiredScreenplayFlag(context.flags.scene, '--scene'),
      beatSheetId: requiredScreenplayFlag(context.flags.beatSheet, '--beat-sheet'),
    });
    await notifyScreenplayMutation(context, report, 'screenplay beat-sheet set-active');
    writeScreenplayJson(context.io, report);
    return 0;
  }
  throw unknownScreenplayCommand(nested);
}
