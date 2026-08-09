import type {
  SceneBeatsInput,
  SceneBeatsOperationsInput,
} from '@gorenku/studio-core/server';
import { readScreenplayJsonInput } from './authoring.js';
import type { ScreenplayCommandContext } from './index.js';
import {
  notifyScreenplayMutation,
  requiredScreenplayFlag,
  unknownScreenplayCommand,
  writeScreenplayJson,
} from './index.js';

export async function runScreenplayBeatsCommand(context: ScreenplayCommandContext): Promise<number> {
  const [, nested, id] = context.input;
  const project = { homeDir: context.homeDir, projectName: context.flags.project };

  if (nested === 'context') {
    writeScreenplayJson(context.io, await context.service.readSceneBeatsContext({
      ...project,
      sceneId: requiredScreenplayFlag(context.flags.scene, '--scene'),
      includeVisualReferences: context.flags.includeVisualReferences,
    }));
    return 0;
  }
  if (nested === 'list') {
    writeScreenplayJson(context.io, await context.service.listSceneBeatsRevisions({
      ...project,
      sceneId: requiredScreenplayFlag(context.flags.scene, '--scene'),
    }));
    return 0;
  }
  if (nested === 'show') {
    writeScreenplayJson(context.io, await context.service.readSceneBeatsRevision({
      ...project,
      active: context.flags.active,
      sceneId: context.flags.scene,
      revisionId: context.flags.revision,
    }));
    return 0;
  }
  if (nested === 'storyboard' && id === 'status') {
    writeScreenplayJson(context.io, await context.service.readSceneStoryboardStatus({
      ...project,
      sceneId: requiredScreenplayFlag(context.flags.scene, '--scene'),
      sceneBeatsRevisionId: requiredScreenplayFlag(context.flags.revision, '--revision'),
    }));
    return 0;
  }
  if (nested === 'validate' || nested === 'create' || nested === 'reset') {
    const filePath = requiredScreenplayFlag(context.flags.file, '--file');
    const document = await readScreenplayJsonInput(filePath) as SceneBeatsInput;
    const commandInput = {
      ...project,
      document,
      filePath: filePath !== '-' ? filePath : undefined,
    };
    let report;
    if (nested === 'validate') {
      report = await context.service.validateSceneBeats(commandInput);
    } else if (nested === 'create') {
      report = await context.service.createSceneBeatsRevision(commandInput);
    } else {
      report = await context.service.resetSceneBeats(commandInput);
    }
    if (nested !== 'validate') {
      await notifyScreenplayMutation(context, report, `screenplay beats ${nested}`);
    }
    writeScreenplayJson(context.io, report);
    return 0;
  }
  if (nested === 'validate-operations' || nested === 'apply') {
    const filePath = requiredScreenplayFlag(context.flags.file, '--file');
    const document = await readScreenplayJsonInput(filePath) as SceneBeatsOperationsInput;
    const report = nested === 'validate-operations'
      ? await context.service.validateSceneBeatsOperations({
          ...project,
          document,
          filePath: filePath !== '-' ? filePath : undefined,
        })
      : await context.service.applySceneBeatsOperations({
          ...project,
          document,
          filePath: filePath !== '-' ? filePath : undefined,
          dryRun: context.flags.dryRun,
        });
    if (nested === 'apply' && !context.flags.dryRun) {
      await notifyScreenplayMutation(context, report, 'screenplay beats apply');
    }
    writeScreenplayJson(context.io, report);
    return 0;
  }
  if (nested === 'set-active') {
    const report = await context.service.setActiveSceneBeatsRevision({
      ...project,
      sceneId: requiredScreenplayFlag(context.flags.scene, '--scene'),
      revisionId: requiredScreenplayFlag(context.flags.revision, '--revision'),
    });
    await notifyScreenplayMutation(context, report, 'screenplay beats set-active');
    writeScreenplayJson(context.io, report);
    return 0;
  }
  throw unknownScreenplayCommand(nested);
}
