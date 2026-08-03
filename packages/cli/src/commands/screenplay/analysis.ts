import type { ScreenplayAnalysis } from '@gorenku/studio-core/server';
import { readScreenplayJsonInput } from './authoring.js';
import type { ScreenplayCommandContext } from './index.js';
import {
  notifyScreenplayMutation,
  requiredScreenplayFlag,
  unknownScreenplayCommand,
  writeScreenplayJson,
} from './index.js';

export async function runScreenplayAnalysisCommand(context: ScreenplayCommandContext): Promise<number> {
  const [, nested] = context.input;
  const project = { homeDir: context.homeDir, projectName: context.flags.project };

  if (nested === 'context') {
    writeScreenplayJson(context.io, await context.service.readScreenplayAnalysisContext(project));
    return 0;
  }
  if (nested === 'list') {
    writeScreenplayJson(context.io, await context.service.listScreenplayAnalyses(project));
    return 0;
  }
  if (nested === 'show') {
    writeScreenplayJson(context.io, await context.service.readScreenplayAnalysis({
      ...project,
      active: context.flags.active,
      analysisId: context.flags.analysis,
    }));
    return 0;
  }
  if (nested === 'validate' || nested === 'write') {
    const filePath = requiredScreenplayFlag(context.flags.file, '--file');
    const analysis = await readScreenplayJsonInput(filePath) as ScreenplayAnalysis;
    const report = nested === 'validate'
      ? await context.service.validateScreenplayAnalysis({
          ...project,
          analysis,
          filePath: filePath !== '-' ? filePath : undefined,
        })
      : await context.service.writeScreenplayAnalysis({
          ...project,
          analysis,
          filePath: filePath !== '-' ? filePath : undefined,
        });
    if (nested === 'write') {
      await notifyScreenplayMutation(context, report, 'screenplay analyze write');
    }
    writeScreenplayJson(context.io, report);
    return 0;
  }
  if (nested === 'set-active') {
    const report = await context.service.setActiveScreenplayAnalysis({
      ...project,
      analysisId: requiredScreenplayFlag(context.flags.analysis, '--analysis'),
    });
    await notifyScreenplayMutation(context, report, 'screenplay analyze set-active');
    writeScreenplayJson(context.io, report);
    return 0;
  }
  throw unknownScreenplayCommand(nested);
}
