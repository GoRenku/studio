import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import type { ImportScreenplaySupportingMaterialReport } from '@gorenku/studio-core/server';
import type { ScreenplayCommandContext } from './index.js';
import {
  requiredScreenplayFlag,
  resolveScreenplayProjectName,
  writeScreenplayJson,
} from './index.js';

export async function runScreenplaySupportingMaterialCommand(
  context: ScreenplayCommandContext,
): Promise<number> {
  if (context.input[1] !== 'import') {
    throw unknownSupportingMaterialCommand(context.input[1]);
  }
  const report = await context.service.importScreenplaySupportingMaterial({
    projectName: await resolveScreenplayProjectName(context),
    homeDir: context.homeDir,
    sourcePath: requiredScreenplayFlag(context.flags.file, '--file'),
  });
  if (context.json) {
    writeScreenplayJson(context.io, report);
  } else {
    writeHumanReport(context, report);
  }
  return 0;
}

function writeHumanReport(
  context: ScreenplayCommandContext,
  report: ImportScreenplaySupportingMaterialReport,
): void {
  const file = report.material.files[0]!;
  if (report.status === 'unchanged') {
    context.io.stdout.log(`Supporting material is already imported: ${file.projectRelativePath}`);
    return;
  }
  context.io.stdout.log(`Imported supporting material: ${file.projectRelativePath}`);
  context.io.stdout.log(`SHA-256: ${file.contentHash}`);
}

function unknownSupportingMaterialCommand(subcommand: string | undefined): StructuredError {
  return new StructuredError({
    code: 'CLI091',
    message: 'Unknown screenplay supporting-material command.',
    issues: [createDiagnosticError(
      'CLI091',
      'Unknown screenplay supporting-material command.',
      { path: ['screenplay', 'supporting-material', subcommand ?? ''] },
      'Use import.',
    )],
    suggestion: 'Use screenplay supporting-material import.',
  });
}
