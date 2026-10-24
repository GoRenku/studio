import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  readCastMemberDeleteDependencySummary,
  type CastMemberDeleteDependencySummary,
} from '../../database/access/cast-members.js';
import { listSceneBeatsRevisionsNamingCastMember } from '../../database/access/scene-beats.js';
import { notFoundIssue, type CastOperationContext, type CastOperationHandler } from './context.js';

export const deleteCastMember: CastOperationHandler<'castMember.delete'> = (context, operation, path) => {
  const index = context.draft.findIndex((castMember) => castMember.id === operation.castMemberId);
  if (index === -1) {
    context.issues.push(notFoundIssue('cast member', [...path, 'castMemberId']));
    return;
  }
  const issues = castMemberDeleteIssues(context, operation.castMemberId, [...path, 'castMemberId']);
  if (issues.length > 0) {
    context.issues.push(...issues);
    return;
  }
  context.draft.splice(index, 1);
  context.changes.push({ operation: operation.operation, castMemberId: operation.castMemberId });
};

/** Everything that still points at a Cast Member and would dangle if it were removed. */
export function castMemberDeleteIssues(
  context: Pick<CastOperationContext, 'session' | 'referencedCastMemberIds'>,
  castMemberId: string,
  path: string[]
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  if (context.referencedCastMemberIds.has(castMemberId)) {
    issues.push(createDiagnosticError(
      'PROJECT_DATA216',
      'Cast member is still referenced by screenplay scenes or blocks.',
      { path },
      'Revise screenplay scene references before deleting this cast member.'
    ));
  }
  const dependencyLabels = castMemberDeleteDependencyLabels(
    readCastMemberDeleteDependencySummary(context.session, castMemberId)
  );
  if (dependencyLabels.length > 0) {
    issues.push(createDiagnosticError(
      'PROJECT_DATA217',
      `Cast member has dependent ${joinDependencyLabels(dependencyLabels)}.`,
      { path },
      'Remove or reassign dependent Cast assets, Cast Designs and Looks before deleting this cast member.'
    ));
  }
  const sceneBeatRevisions = listSceneBeatsRevisionsNamingCastMember(context.session, castMemberId);
  if (sceneBeatRevisions.length > 0) {
    issues.push(createDiagnosticError(
      'PROJECT_DATA218',
      `Cast member is named by ${pluralizeDependency('Scene Beats revision', sceneBeatRevisions.length)}.`,
      { path },
      'Resolve references in those Scene Beats revisions before deleting this Cast Member.'
    ));
  }
  return issues;
}

function castMemberDeleteDependencyLabels(dependencies: CastMemberDeleteDependencySummary): string[] {
  return [
    dependencies.assetFileCount > 0 ? pluralizeDependency('Cast asset', dependencies.assetFileCount) : null,
    dependencies.designCount > 0 ? pluralizeDependency('Cast Design', dependencies.designCount) : null,
    dependencies.activeDesignStateCount > 0 ? 'active Cast Design state' : null,
    dependencies.lookCount > 0 ? pluralizeDependency('Look', dependencies.lookCount) : null,
    dependencies.voiceCount > 0 ? pluralizeDependency('Cast Voice', dependencies.voiceCount) : null,
  ].filter((label): label is string => label !== null);
}

function joinDependencyLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? 'records';
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function pluralizeDependency(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}
