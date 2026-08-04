import type { ImportFdxScreenplayReport } from '@gorenku/studio-core/server';
import type { ScreenplayCommandContext } from './index.js';
import {
  notifyScreenplayMutation,
  requiredScreenplayFlag,
  resolveScreenplayProjectName,
  writeScreenplayJson,
} from './index.js';

export async function runScreenplayFdxImportCommand(
  context: ScreenplayCommandContext,
): Promise<number> {
  const report = await context.service.importFdxScreenplay({
    projectName: await resolveScreenplayProjectName(context),
    homeDir: context.homeDir,
    sourcePath: requiredScreenplayFlag(context.flags.file, '--file'),
  });
  await notifyScreenplayMutation(context, report, 'screenplay import-fdx');
  if (context.json) {
    writeScreenplayJson(context.io, report);
  } else {
    writeHumanReport(context, report);
  }
  return 0;
}

function writeHumanReport(
  context: ScreenplayCommandContext,
  report: ImportFdxScreenplayReport,
): void {
  const counts = report.counts;
  context.io.stdout.log(`Imported ${report.screenplayImport.sourceFilename}`);
  context.io.stdout.log(`SHA-256: ${report.screenplayImport.sha256}`);
  context.io.stdout.log(
    `Scenes: ${counts.scenes}; Acts: ${counts.acts}; Sequences: ${counts.sequences}`,
  );
  context.io.stdout.log(
    `Blocks: ${counts.blocks}; Dialogue turns: ${counts.dialogueTurns}; Scene numbers: ${counts.productionSceneNumbers}`,
  );
  context.io.stdout.log(
    `Candidates: ${report.candidates.characterCues.length} character cues; ${report.candidates.sceneHeadings.length} scene headings; ${report.candidates.taggedSubjects.length} tagged subjects`,
  );
}
