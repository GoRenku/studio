import type { ProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioCastMemberSurfaceResourceKey } from '../studio-coordination/resource-keys.js';

/** The shared head of every casting report; casting changes refresh the Cast Member's page. */
export function castingReportBase(project: ProjectRecord | null, castMemberId: string) {
  if (!project) {
    throw new ProjectDataError('PROJECT_DATA021', 'Project database has no project row.');
  }
  return {
    valid: true as const,
    warnings: [],
    project: { id: project.id, projectName: project.projectName },
    resourceKeys: [studioCastMemberSurfaceResourceKey(castMemberId)],
  };
}
