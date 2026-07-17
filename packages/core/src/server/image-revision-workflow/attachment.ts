import type {
  GenerationRun,
  ImageRevisionTarget,
} from '../../client/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import {
  castCharacterSheetAttachmentDestination,
  locationSheetAttachmentDestination,
  lookbookImageAttachmentDestination,
  lookbookSheetAttachmentDestination,
  type GeneratedMediaAttachmentDestination,
} from '../generation/attachment-destinations.js';
import { persistGeneratedMediaAttachment } from '../generation/attachment-persistence.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ResolvedImageRevisionSource } from './source.js';

export function attachImageRevisionOutput(input: {
  session: DatabaseSession;
  projectFolder: string;
  target: ImageRevisionTarget;
  source: ResolvedImageRevisionSource;
  run: GenerationRun;
  sourceProjectRelativePath: string;
  idGenerator: ProjectIdGenerator;
  now: string;
}): {
  imported: { assetId: string; assetFileId: string };
  resourceKeys: string[];
} {
  const destination = revisionDestination(input);
  const persisted = persistGeneratedMediaAttachment({
    session: input.session,
    projectFolder: input.projectFolder,
    idGenerator: input.idGenerator,
    now: input.now,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    destination: destination.destination,
    asset: {
      type: input.source.asset.type,
      mediaKind: 'image',
      title: input.source.asset.title,
      ...(input.source.asset.oneLineSummary
        ? { oneLineSummary: input.source.asset.oneLineSummary }
        : {}),
      origin: 'generated',
    },
    fileRole: destination.role,
    relationshipRole: destination.role,
    provenanceReceipt: { run: input.run },
  });
  return {
    imported: {
      assetId: persisted.assetId,
      assetFileId: persisted.assetFileId,
    },
    resourceKeys: destination.destination.resourceKeys,
  };
}

function revisionDestination(input: {
  target: ImageRevisionTarget;
  source: ResolvedImageRevisionSource;
}): {
  destination: GeneratedMediaAttachmentDestination;
  role: string;
} {
  switch (input.target.kind) {
    case 'castCharacterSheet':
      return {
        destination: castCharacterSheetAttachmentDestination(
          input.target.castMemberId,
          input.source.asset.title
        ),
        role: requireOwnerRole(input.source, ['character-sheet']),
      };
    case 'locationEnvironmentSheet':
      return {
        destination: locationSheetAttachmentDestination(
          input.target.locationId,
          input.source.asset.title
        ),
        role: requireOwnerRole(input.source, [
          'environment-sheet',
          'location-sheet',
        ]),
      };
    case 'lookbookImage':
      return {
        destination: lookbookImageAttachmentDestination(
          input.target.lookbookId,
          input.source.asset.title
        ),
        role: requireOwnerRole(input.source, ['lookbook-image']),
      };
    case 'lookbookSheet':
      return {
        destination: lookbookSheetAttachmentDestination(
          input.target.lookbookId,
          input.source.asset.title
        ),
        role: requireOwnerRole(input.source, [
          'storyboard-lookbook-sheet',
          'video-lookbook-sheet',
        ]),
      };
  }
}

function requireOwnerRole(
  source: ResolvedImageRevisionSource,
  allowedRoles: string[]
): string {
  if (source.ownerRole && allowedRoles.includes(source.ownerRole)) {
    return source.ownerRole;
  }
  throw new ProjectDataError(
    'CORE_IMAGE_REVISION_OWNER_MISMATCH',
    'The Image Revision source no longer has an eligible owner role.'
  );
}
