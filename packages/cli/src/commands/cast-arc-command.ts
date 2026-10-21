import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import {
  characterArcDocumentSchema,
  characterArcsWriteDocumentSchema,
  type CharacterArcsWriteDocument,
} from '@gorenku/studio-core/client';
import { createProjectDataService } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';
import { readRequiredJsonInput, requiredFlag, writeJson } from './command-io.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

/** `renku cast arc <schema|validate|write|list|show>` */
export async function runCastArcCommand(options: {
  subcommand: string | undefined;
  flags: { file?: string; project?: string; cast?: string };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const service = createProjectDataService();
  const homeDir = options.homeDir;

  switch (options.subcommand) {
    case 'schema':
      writeJson(options.io, {
        writeDocument: characterArcsWriteDocumentSchema,
        characterArc: characterArcDocumentSchema,
      });
      return 0;
    case 'validate': {
      const filePath = requiredFlag(options.flags.file, '--file');
      const document = await readRequiredJsonInput(filePath, 'cast arc validate');
      writeJson(options.io, await service.validateCharacterArcs({
        homeDir,
        document: document as CharacterArcsWriteDocument,
        filePath: filePath !== '-' ? filePath : undefined,
      }));
      return 0;
    }
    case 'write': {
      const filePath = requiredFlag(options.flags.file, '--file');
      const document = await readRequiredJsonInput(filePath, 'cast arc write');
      const report = await service.writeCharacterArcs({
        homeDir,
        document: document as CharacterArcsWriteDocument,
        filePath: filePath !== '-' ? filePath : undefined,
      });
      await appendStudioResourceChangedEvent({
        runtime: {
          projectName: options.flags.project,
          homeDir,
          json: options.json,
          io: options.io,
          projectDataService: service,
        },
        report,
        command: 'cast arc write',
      });
      writeJson(options.io, report);
      return 0;
    }
    case 'list':
      writeJson(options.io, await service.listCharacterArcs({ homeDir }));
      return 0;
    case 'show':
      writeJson(options.io, await service.readCharacterArc({
        homeDir,
        castMemberId: requiredFlag(options.flags.cast, '--cast'),
      }));
      return 0;
    default:
      throw new StructuredError({
        code: 'CLI101',
        message: 'Unknown cast arc command.',
        issues: [
          createDiagnosticError(
            'CLI101',
            'Unknown cast arc command.',
            { path: ['cast', 'arc', options.subcommand ?? ''] },
            'Use schema, validate, write, list, or show.'
          ),
        ],
        suggestion: 'Use a supported cast arc command.',
      });
  }
}
