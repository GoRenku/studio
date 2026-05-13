import { ProjectDataError } from '../project-data-error.js';
import type { AssetTarget } from '../../client/index.js';
import {
  insertAssetFileRecord,
} from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  insertAssetRelationshipRecord,
} from '../database/access/asset-relationships/index.js';
import { assetRelationshipTableConfig } from '../database/access/asset-relationships/targets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  allocateWorkingMarkdownAssetPath,
  type MarkdownAssetPathTarget,
} from '../files/asset-paths.js';
import type { ProjectRelativePath } from '../files/project-relative-paths.js';
import type { EntityIdPrefix } from '../entity-ids.js';

export interface ProjectSetupMarkdownAsset {
  id: string;
  fileId: string;
  relationshipId: string;
  title: string;
  content: string;
  projectRelativePath: ProjectRelativePath;
  localeId: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  relationship:
    | { kind: 'project' }
    | { kind: 'visualLanguage'; visualLanguageId: string }
    | { kind: 'castMember'; castMemberId: string }
    | { kind: 'continuityReference'; continuityReferenceId: string }
    | { kind: 'sequence'; sequenceId: string }
    | { kind: 'scene'; sceneId: string }
    | { kind: 'clip'; clipId: string };
}

export function addProjectSetupMarkdownAsset(
  assets: ProjectSetupMarkdownAsset[],
  ids: (prefix: EntityIdPrefix) => string,
  now: string,
  input: {
    content?: string;
    title: string;
    role: string;
    localeId: string | null;
    pathTarget: MarkdownAssetPathTarget;
    fileName: string;
    relationship: ProjectSetupMarkdownAsset['relationship'];
  }
): void {
  if (!input.content?.trim()) {
    return;
  }

  const relationshipPrefix = assetRelationshipTableConfig(
    assetRelationshipTarget(input.relationship)
  ).idPrefix;
  assets.push({
    id: ids('asset'),
    fileId: ids('asset_file'),
    relationshipId: ids(relationshipPrefix),
    title: input.title,
    content: input.content,
    projectRelativePath: allocateWorkingMarkdownAssetPath({
      target: input.pathTarget,
      fileName: input.fileName,
    }),
    localeId: input.localeId,
    role: input.role,
    createdAt: now,
    updatedAt: now,
    relationship: input.relationship,
  });
}

export function insertProjectSetupMarkdownAssetRecords(
  session: DatabaseSession,
  asset: ProjectSetupMarkdownAsset
): void {
  insertAssetRecord(session, {
    id: asset.id,
    type: asset.role,
    mediaKind: 'text',
    title: asset.title,
    origin: 'setup',
    availability: 'ready',
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  });
  insertAssetFileRecord(session, {
    id: asset.fileId,
    assetId: asset.id,
    role: 'primary',
    projectRelativePath: asset.projectRelativePath,
    mimeType: 'text/markdown',
    mediaKind: 'text',
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  });

  insertAssetRelationshipRecord(
    session,
    assetRelationshipTarget(asset.relationship),
    {
      relationshipId: asset.relationshipId,
      assetId: asset.id,
      localeId: asset.localeId,
      role: asset.role,
      sortOrder: 1,
      now: asset.createdAt,
    }
  );
}

export function buildProjectSummaryAsset(input: {
  ids: (prefix: EntityIdPrefix) => string;
  now: string;
  content: string;
  localeId: string | null;
}): ProjectSetupMarkdownAsset {
  const assets: ProjectSetupMarkdownAsset[] = [];
  addProjectSetupMarkdownAsset(assets, input.ids, input.now, {
    content: input.content,
    title: 'Project summary',
    role: 'summary',
    localeId: input.localeId,
    pathTarget: { kind: 'project' },
    fileName: 'project-summary.md',
    relationship: { kind: 'project' },
  });
  const [asset] = assets;
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA063',
      'Project summary asset could not be created from non-empty content.'
    );
  }
  return asset;
}

function assetRelationshipTarget(
  relationship: ProjectSetupMarkdownAsset['relationship']
): AssetTarget {
  if (relationship.kind === 'project') {
    return { kind: 'project' };
  }
  if (relationship.kind === 'visualLanguage') {
    return {
      kind: 'visualLanguage',
      visualLanguageId: relationship.visualLanguageId,
    };
  }
  if (relationship.kind === 'castMember') {
    return { kind: 'castMember', castMemberId: relationship.castMemberId };
  }
  if (relationship.kind === 'continuityReference') {
    return {
      kind: 'continuityReference',
      continuityReferenceId: relationship.continuityReferenceId,
    };
  }
  if (relationship.kind === 'sequence') {
    return { kind: 'sequence', sequenceId: relationship.sequenceId };
  }
  if (relationship.kind === 'scene') {
    return { kind: 'scene', sceneId: relationship.sceneId };
  }
  return { kind: 'clip', clipId: relationship.clipId };
}
