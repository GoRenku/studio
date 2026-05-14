import fs from 'node:fs/promises';
import { WORKING_ASSETS_BASE_ROOT } from '../files/asset-paths.js';
import {
  joinProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import type { ProjectRelativePath } from '../../client/index.js';
import type { ProjectSetup } from './contracts.js';
import { numberedSlug } from './slugs.js';

export function buildSetupWorkspaceFolders(input: {
  setup: ProjectSetup;
  castMemberRecords: { name: string; position: number }[];
}): ProjectRelativePath[] {
  const folders = [joinProjectRelativePath(WORKING_ASSETS_BASE_ROOT, 'cast')];
  for (const castMember of input.castMemberRecords) {
    folders.push(
      joinProjectRelativePath(
        WORKING_ASSETS_BASE_ROOT,
        'cast',
        numberedSlug(castMember.position, castMember.name)
      )
    );
  }
  if ((input.setup.visualLanguageCategories?.length ?? 0) > 0) {
    folders.push(joinProjectRelativePath(WORKING_ASSETS_BASE_ROOT, 'visual-language'));
  }
  if ((input.setup.continuityReferences?.length ?? 0) > 0) {
    folders.push(joinProjectRelativePath(WORKING_ASSETS_BASE_ROOT, 'continuity'));
  }
  return folders;
}

export async function ensureProjectFolders(
  projectFolder: string,
  folders: ProjectRelativePath[]
): Promise<void> {
  await Promise.all(
    folders.map((folder) =>
      fs.mkdir(resolveProjectRelativePath(projectFolder, folder), {
        recursive: true,
      })
    )
  );
}
