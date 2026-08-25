import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  createProjectDataService,
  resolveRenkuProviderCredential,
  type LocationWorldGenerationDocument,
} from '@gorenku/studio-core/server';
import {
  generateWorldLabsLocationWorld,
  isEngineError,
  type WorldLabsLocationWorldImage,
} from '@gorenku/studio-engines';
import {
  createDiagnosticError,
  StructuredError,
} from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../cli.js';
import { readRequiredJsonInput, requiredFlag, writeJson } from './command-io.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';

export async function runLocationWorldCommand(options: {
  input: string[];
  flags: { file?: string; location?: string };
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const [subcommand] = options.input;
  const service = createProjectDataService();
  if (subcommand === 'generate') {
    const document = await readRequiredJsonInput(
      requiredFlag(options.flags.file, '--file'),
      'location world generate',
    ) as LocationWorldGenerationDocument;
    const prepared = await service.prepareLocationWorldGeneration({
      homeDir: options.homeDir,
      document,
    });
    const credential = await resolveRenkuProviderCredential('world-labs', {
      homeDir: options.homeDir,
    });
    if (!credential) {
      throw new StructuredError({
        code: 'PROVIDER_CREDENTIALS004',
        message: 'World Labs credentials are not configured.',
        suggestion: 'Configure WLT_API_KEY in Renku Settings and try again.',
      });
    }
    const source = prepared.source.kind === 'panorama'
      ? { kind: 'panorama' as const, image: await readWorldImage(prepared.source.image) }
      : {
          kind: 'multiImage' as const,
          images: await Promise.all(prepared.source.images.map(readWorldImage)),
        };
    let generated;
    try {
      generated = await generateWorldLabsLocationWorld({
        displayName: `${prepared.location.name} 3D World`.slice(0, 64),
        ...(prepared.document.prompt === undefined ? {} : { prompt: prepared.document.prompt }),
        source,
        credential,
        signal: new AbortController().signal,
      });
    } catch (error) {
      if (isEngineError(error)) {
        throw new StructuredError({ code: error.code, message: error.message });
      }
      throw error;
    }
    const projectRef = await service.resolveStudioProjectRef({ homeDir: options.homeDir });
    const projectFolder = path.join(projectRef.storageRoot, projectRef.name);
    const stagingRelativePath = `tmp/operations/location-world/${randomUUID()}.spz`;
    const stagingPath = path.join(projectFolder, stagingRelativePath);
    try {
      await fs.mkdir(path.dirname(stagingPath), { recursive: true });
      await pipeline(
        Readable.fromWeb(generated.body),
        fsSync.createWriteStream(stagingPath, { flags: 'wx' }),
      );
      const report = await service.persistLocationWorldGeneration({
        homeDir: options.homeDir,
        document,
        sourceProjectRelativePath: stagingRelativePath,
        provider: {
          operationId: generated.operationId,
          worldId: generated.worldId,
        },
      });
      await appendStudioResourceChangedEvent({
        runtime: {
          homeDir: options.homeDir,
          json: options.json,
          io: options.io,
          projectDataService: service,
        },
        report,
        command: 'location world generate',
      });
      writeJson(options.io, report);
      return 0;
    } finally {
      await fs.unlink(stagingPath).catch(() => undefined);
    }
  }
  if (subcommand === 'show') {
    writeJson(
      options.io,
      await service.readLocationWorldResource({
        homeDir: options.homeDir,
        locationId: requiredFlag(options.flags.location, '--location'),
      }),
    );
    return 0;
  }
  throw new StructuredError({
    code: 'CLI164',
    message: 'Unknown Location World command.',
    issues: [
      createDiagnosticError(
        'CLI164',
        'Unknown Location World command.',
        { path: ['location', 'world', subcommand ?? ''] },
        'Use generate or show.',
      ),
    ],
    suggestion: 'Use `renku location world generate` or `renku location world show`.',
  });
}

async function readWorldImage(image: {
  fileName: string;
  extension: 'jpg' | 'jpeg' | 'png' | 'webp';
  mimeType: string;
  absolutePath: string;
}): Promise<WorldLabsLocationWorldImage> {
  return { ...image, bytes: await fs.readFile(image.absolutePath) };
}
