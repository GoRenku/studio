import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../project-data-error.js';

/** Casting failures report every issue at once under one stable code. */
export function throwCastingIssues(issues: DiagnosticIssue[]): never {
  const first = issues[0];
  throw new ProjectDataError(first?.code ?? 'CASTING_DOCUMENT_INVALID', first?.message ?? 'Casting input is invalid.', {
    issues,
    ...(first?.suggestion ? { suggestion: first.suggestion } : {}),
  });
}

export function castingIssue(code: string, message: string, path: string[], suggestion?: string): DiagnosticIssue {
  return createDiagnosticError(code, message, { path }, suggestion);
}

export function castMemberNotFound(castMemberId: string): ProjectDataError {
  return new ProjectDataError('CASTING_CAST_MEMBER_NOT_FOUND', `Cast Member was not found: ${castMemberId}.`, {
    suggestion: 'List Cast Members with `renku cast list`.',
  });
}

export function lookNotFound(lookId: string): ProjectDataError {
  return new ProjectDataError('CASTING_LOOK_NOT_FOUND', `Cast Look was not found: ${lookId}.`, {
    suggestion: 'List the Looks with `renku cast looks show --cast <cast-member-id>`.',
  });
}

export function costumeNotFound(costumeId: string): ProjectDataError {
  return new ProjectDataError('CASTING_COSTUME_NOT_FOUND', `Cast Costume was not found: ${costumeId}.`, {
    suggestion: 'List the costumes with `renku cast wardrobe show --cast <cast-member-id>`.',
  });
}
