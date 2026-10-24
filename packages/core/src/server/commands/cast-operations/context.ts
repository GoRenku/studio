import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CastMember } from '../../../client/cast-members.js';
import type {
  CastMemberInput,
  CastOperation,
  DepartmentCommandChange,
  DepartmentGeneratedId,
} from '../../../client/department-design.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';

/** The state one cast operations document builds up before anything is written. */
export interface CastOperationContext {
  session: DatabaseSession;
  idGenerator?: ProjectIdGenerator;
  /** The Cast list as it will be after the document applies. */
  draft: CastMember[];
  /** Cast Members referenced by the current screenplay. */
  referencedCastMemberIds: Set<string>;
  issues: DiagnosticIssue[];
  changes: DepartmentCommandChange[];
  generatedIds: DepartmentGeneratedId[];
}

export type CastOperationHandler<K extends CastOperation['operation']> = (
  context: CastOperationContext,
  operation: Extract<CastOperation, { operation: K }>,
  path: string[]
) => void;

export function toCastMember(input: CastMemberInput): CastMember {
  if (!input.id) {
    throw new ProjectDataError('PROJECT_DATA206', 'Cast member requires id.', {
      suggestion: 'Use key for adds and id for updates.',
    });
  }
  return {
    id: input.id,
    handle: input.handle,
    name: input.name,
    role: input.role,
    isVoiceOver: input.isVoiceOver ?? false,
    age: input.age,
    want: input.want,
    need: input.need,
    arc: input.arc,
    voiceNotes: input.voiceNotes,
    description: input.description,
  };
}

export function notFoundIssue(label: string, path: string[]): DiagnosticIssue {
  return createDiagnosticError(
    'PROJECT_DATA205',
    `${label} was not found.`,
    { path },
    'Check the id from the latest list command.'
  );
}
