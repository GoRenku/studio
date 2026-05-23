import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Lookbook,
  LookbookImage,
} from '../../client/index.js';
import {
  deleteAssetFileRecordsForAsset,
  insertAssetFileRecord,
} from '../database/access/asset-files.js';
import {
  deleteAssetRecord,
  insertAssetRecord,
} from '../database/access/assets.js';
import {
  readLookbookRecord,
  requireLookbookRecordById,
  toLookbook,
  upsertLookbookRecord,
} from '../database/access/lookbook.js';
import {
  deleteLookbookImageRecord,
  insertLookbookImageRecord,
  nextLookbookImageSortOrder,
  readLookbookImage,
  requireLookbookImageRecord,
  setLookbookImageSectionRecords,
} from '../database/access/lookbook-images.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import type {
  DeleteLookbookImageInput,
  ImportLookbookImageInput,
  SetLookbookImageSectionsInput,
  UpsertLookbookInput,
} from '../project-data-service-contracts.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  assertLookbookSections,
  serializeLookbookSections,
} from '../visual-language-json/validator.js';
import {
  allocateProjectRelativeFilePath,
  assertProjectRelativeChildPath,
  assertResolvedPathInsideProject,
  LOOKBOOK_ROOT,
} from '../visual-language-paths.js';

export async function upsertLookbook(input: UpsertLookbookInput): Promise<Lookbook> {
  return withVisualLanguageSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const sections = serializeLookbookSections({
      sections: input.sections,
      filePath: input.filePath,
    });
    upsertLookbookRecord(session, {
      id: ids('lookbook'),
      sections,
      now: new Date().toISOString(),
    });
    const row = readLookbookRecord(session);
    if (!row) {
      throw new ProjectDataError('PROJECT_DATA243', 'Lookbook was not written.');
    }
    return toLookbook(row);
  });
}

export async function importLookbookImage(
  input: ImportLookbookImageInput
): Promise<LookbookImage> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const lookbook = readLookbookRecord(session);
    if (!lookbook) {
      throw new ProjectDataError(
        'PROJECT_DATA236',
        'A Lookbook must exist before importing Lookbook images.'
      );
    }
    requireLookbookRecordById(session, lookbook.id);

    const sourceProjectRelativePath = normalizeProjectRelativePath(
      input.projectRelativePath
    );
    const sourcePath = resolveProjectRelativePath(
      projectFolder,
      sourceProjectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, sourcePath);
    const stats = await statExistingFile(sourcePath);

    const destinationProjectRelativePath = await allocateProjectRelativeFilePath({
      projectFolder,
      parent: LOOKBOOK_ROOT,
      fileName: path.basename(sourceProjectRelativePath),
    });
    const destinationPath = resolveProjectRelativePath(
      projectFolder,
      destinationProjectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, destinationPath);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    if (sourcePath !== destinationPath) {
      await fs.copyFile(sourcePath, destinationPath);
    }

    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    const now = new Date().toISOString();
    const assetId = ids('asset');
    const imageId = ids('lookbook_image');
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      insertAssetRecord(txSession, {
        id: assetId,
        type: 'lookbook_image',
        mediaKind: 'image',
        title: input.title?.trim() || path.parse(destinationProjectRelativePath).name,
        oneLineSummary: input.oneLineSummary?.trim() || undefined,
        origin: 'generated',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetFileRecord(txSession, {
        id: ids('asset_file'),
        assetId,
        role: 'source',
        projectRelativePath: destinationProjectRelativePath,
        mediaKind: 'image',
        sizeBytes: stats.size,
        createdAt: now,
        updatedAt: now,
      });
      insertLookbookImageRecord(txSession, {
        id: imageId,
        lookbookId: lookbook.id,
        assetId,
        sortOrder: nextLookbookImageSortOrder(txSession, lookbook.id),
        now,
      });
      setLookbookImageSectionRecords(txSession, {
        imageId,
        sections: assertLookbookSections(input.sections ?? []),
        nextId: () => ids('lookbook_image_section'),
        now,
      });
    });

    const image = readLookbookImage(session, imageId);
    if (!image) {
      throw new ProjectDataError(
        'PROJECT_DATA244',
        `Lookbook image was not imported: ${imageId}.`
      );
    }
    return image;
  });
}

export async function setLookbookImageSections(
  input: SetLookbookImageSectionsInput
): Promise<LookbookImage> {
  return withVisualLanguageSession(input, ({ session }) => {
    requireLookbookImageRecord(session, input.imageId);
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    setLookbookImageSectionRecords(session, {
      imageId: input.imageId,
      sections: assertLookbookSections(input.sections),
      nextId: () => ids('lookbook_image_section'),
      now: new Date().toISOString(),
    });
    const image = readLookbookImage(session, input.imageId);
    if (!image) {
      throw new ProjectDataError(
        'PROJECT_DATA237',
        `Lookbook image was not found: ${input.imageId}.`
      );
    }
    return image;
  });
}

export async function deleteLookbookImage(
  input: DeleteLookbookImageInput
): Promise<void> {
  return withVisualLanguageSession(input, async ({ session, projectFolder }) => {
    const image = requireLookbookImageRecord(session, input.imageId);
    const lookbookImage = readLookbookImage(session, input.imageId);
    if (!lookbookImage) {
      throw new ProjectDataError(
        'PROJECT_DATA237',
        `Lookbook image was not found: ${input.imageId}.`
      );
    }
    for (const file of lookbookImage.asset.files) {
      const projectRelativePath = normalizeProjectRelativePath(file.projectRelativePath);
      assertProjectRelativeChildPath({
        parent: LOOKBOOK_ROOT,
        child: projectRelativePath,
      });
      await fs.rm(resolveProjectRelativePath(projectFolder, projectRelativePath), {
        force: true,
      });
    }
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      deleteLookbookImageRecord(txSession, image.id);
      deleteAssetFileRecordsForAsset(txSession, image.assetId);
      deleteAssetRecord(txSession, image.assetId);
    });
  });
}

async function statExistingFile(absolutePath: string): Promise<{ size: number }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a regular file');
    }
    return { size: stats.size };
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA245',
      `Generated Lookbook image file does not exist: ${absolutePath}.`
    );
  }
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
