export const PROJECT_KIND = 'renku.project' as const;
export const WORKFLOW_KIND = 'renku.workflow' as const;
export const TASK_KIND = 'renku.task' as const;

export type ProjectKind = typeof PROJECT_KIND;
export type WorkflowKind = typeof WORKFLOW_KIND;
export type TaskKind = typeof TASK_KIND;

export interface StudioCorePackageInfo {
  packageName: '@gorenku/studio-core';
  purpose: 'renku-studio-domain';
}

export function getStudioCorePackageInfo(): StudioCorePackageInfo {
  return {
    packageName: '@gorenku/studio-core',
    purpose: 'renku-studio-domain',
  };
}

export type {
  CastMember,
  Clip,
  Episode,
  Project,
  ProjectCoverImage,
  ProjectCounts,
  ProjectCreateReport,
  ProjectDataErrorContract,
  ProjectIdentity,
  ProjectLanguage,
  ProjectLibrary,
  RichTextAssetLink,
  ProjectSummary,
  ProjectType,
  Scene,
  Sequence,
  VisualLanguage,
} from './project/index.js';
export { ProjectDataError } from './project/index.js';
