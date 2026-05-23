import type {
  LookbookImage,
  LookbookResource,
  LookbookSection,
} from '../../client/index.js';
import {
  readLookbookRecord,
  toLookbook,
} from '../database/access/lookbook.js';
import { listLookbookImages } from '../database/access/lookbook-images.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ReadLookbookInput } from '../project-data-service-contracts.js';

export async function readLookbookResource(
  input: ReadLookbookInput
): Promise<LookbookResource> {
  return withVisualLanguageSession(input, ({ session }) => {
    const row = readLookbookRecord(session);
    const lookbook = row ? toLookbook(row) : null;
    const images = row ? listLookbookImages(session, row.id) : [];
    return {
      lookbook,
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
