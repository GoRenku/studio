import type { LookbookKind } from '../../client/visual-language.js';
import type { MediaGenerationLookbookContext } from '../../client/media-generation-context.js';
import type { DepartmentLookbookContext } from '../../client/department-design.js';
import { readLookbookRecordByKind } from '../database/access/lookbook.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readProjectRecord } from '../database/access/project.js';
import { readLookbookResourceFromSession } from '../resources/project-lookbooks.js';

export function readMediaGenerationLookbookContext(input: {
  session: DatabaseSession;
  projectFolder: string;
  kind: LookbookKind;
}): MediaGenerationLookbookContext | null {
  const row = readLookbookRecordByKind(input.session, input.kind);
  const project = readProjectRecord(input.session);
  if (!row || !project) {
    return null;
  }
  const resource = readLookbookResourceFromSession(
    input.session,
    input.projectFolder,
    project,
    row,
  );
  return {
    kind: input.kind,
    lookbook: resource.lookbook,
    selectedImageId: resource.selectedImageId,
    images: resource.images,
    sheets: resource.sheets,
  };
}

export function readMediaGenerationLookbooks(input: {
  session: DatabaseSession;
  projectFolder: string;
  kinds: LookbookKind[];
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
  const context = readMediaGenerationLookbookContext({ ...input, kind: 'production' });
  if (!context) {
    return null;
  }
  return {
    lookbook: context.lookbook,
    selectedImage: context.images.find((image) => image.id === context.selectedImageId) ?? null,
    isActive: true,
  };
}
