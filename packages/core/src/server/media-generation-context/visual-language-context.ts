import type { LookbookKind } from '../../client/visual-language.js';
import type { MediaGenerationLookbookContext } from '../../client/media-generation-context.js';
import type { DepartmentLookbookContext } from '../../client/department-design.js';
import { readLookbookRecordByKind } from '../database/access/lookbook.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import { readLookbookResourceFromSession } from '../resources/project-lookbooks.js';
import { type GenerationAssetFiles, projectGenerationLookbookImage, projectGenerationLookbookSheet } from './reference-assets.js';

export function readMediaGenerationLookbookContext(input: {
  session: DatabaseSession;
  projectFolder: string;
  kind: LookbookKind;
  assetFiles: GenerationAssetFiles;
}): MediaGenerationLookbookContext | null {
  const resource = readLookbookContextResource(input);
  return resource ? {
    kind: input.kind,
    lookbook: resource.lookbook,
    selectedImageId: resource.selectedImageId,
    images: resource.images.map((image) => projectGenerationLookbookImage(image, input.assetFiles)),
    sheets: resource.sheets.map((sheet) => projectGenerationLookbookSheet(sheet, input.assetFiles)),
  } : null;
}

function readLookbookContextResource(input: {
  session: DatabaseSession;
  projectFolder: string;
  kind: LookbookKind;
}) {
  const row = readLookbookRecordByKind(input.session, input.kind);
  const project = readProjectRecord(input.session);
  if (!row || !project) {
    return null;
  }
  return readLookbookResourceFromSession(
    input.session,
    input.projectFolder,
    project,
    row,
  );
}

export function readMediaGenerationLookbooks(input: {
  session: DatabaseSession;
  projectFolder: string;
  kinds: LookbookKind[];
  assetFiles: GenerationAssetFiles;
}): MediaGenerationLookbookContext[] {
  return input.kinds.flatMap((kind) => {
    const context = readMediaGenerationLookbookContext({ ...input, kind });
    return context ? [context] : [];
  });
}

export function readDepartmentProductionLookbookContext(input: {
  session: DatabaseSession;
  projectFolder: string;
}): DepartmentLookbookContext | null {
  const context = readLookbookContextResource({ ...input, kind: 'production' });
  if (!context) {
    return null;
  }
  return {
    lookbook: context.lookbook,
    selectedImage: context.images.find((image) => image.assetFile.id === context.selectedImageId) ?? null,
    isActive: true,
  };
}
