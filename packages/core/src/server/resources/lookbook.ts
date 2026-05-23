import type {
  LookbookImage,
  LookbookListItem,
  LookbookResource,
  LookbooksResource,
  LookbookSection,
} from '../../client/index.js';
import {
  listLookbookCardImageIds,
  listLookbookRecords,
  readActiveLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../database/access/lookbook.js';
import {
  listLookbookImages,
  readLookbookImage,
} from '../database/access/lookbook-images.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  ListLookbooksInput,
  ReadLookbookInput,
} from '../project-data-service-contracts.js';

export async function listLookbooksResource(
  input: ListLookbooksInput
): Promise<LookbooksResource> {
  return withVisualLanguageSession(input, ({ session }) => {
    const activeLookbookId = readActiveLookbookId(session);
    const cardImageIds = listLookbookCardImageIds(session);
    const lookbooks: LookbookListItem[] = listLookbookRecords(session).map((row) => ({
      lookbook: toLookbook(row),
      cardImage: readCardImage(session, cardImageIds.get(row.id)),
      isActive: activeLookbookId === row.id,
    }));
    return { activeLookbookId, lookbooks };
  });
}

export async function readLookbookResource(
  input: ReadLookbookInput
): Promise<LookbookResource> {
  return withVisualLanguageSession(input, ({ session }) => {
    const row = requireLookbookRecordById(session, input.lookbookId);
    const images = listLookbookImages(session, row.id);
    const cardImageIds = listLookbookCardImageIds(session);
    return {
      lookbook: toLookbook(row),
      cardImage: readCardImage(session, cardImageIds.get(row.id)),
      isActive: readActiveLookbookId(session) === row.id,
      images,
      imagesBySection: buildImagesBySection(images),
    };
  });
}

export function buildImagesBySection(
  images: LookbookImage[]
): Record<LookbookSection, LookbookImage[]> {
  const grouped: Record<LookbookSection, LookbookImage[]> = {
    thesis: [],
    palette: [],
    tone_mood: [],
    composition: [],
    lighting: [],
    texture: [],
    camera: [],
  };
  for (const image of images) {
    for (const section of image.sections) {
      grouped[section].push(image);
    }
  }
  return grouped;
}

function readCardImage(
  session: DatabaseSession,
  imageId: string | undefined
): LookbookImage | null {
  return imageId ? readLookbookImage(session, imageId) : null;
}

async function withVisualLanguageSession<T>(
  input: { projectName?: string; homeDir?: string },
  fn: (handle: { projectFolder: string; session: DatabaseSession }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn(handle);
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({ projectFolder: currentProject.projectFolder, session })
  );
}
