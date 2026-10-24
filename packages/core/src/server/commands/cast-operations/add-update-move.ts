import {
  allocateDepartmentId,
  applyPlacement,
  assertExistingObjectUsesId,
  assertNewObjectUsesKey,
  moveByPlacement,
} from '../department-command-support.js';
import { notFoundIssue, toCastMember, type CastOperationHandler } from './context.js';

export const addCastMember: CastOperationHandler<'castMember.add'> = (context, operation, path) => {
  assertNewObjectUsesKey({
    id: operation.castMember.id,
    key: operation.castMember.key,
    path: [...path, 'castMember'],
    label: 'cast member',
    issues: context.issues,
  });
  if (context.issues.length > 0) {
    return;
  }
  const id = allocateDepartmentId({
    prefix: 'cast',
    key: operation.castMember.key as string,
    kind: 'cast',
    path: [...path, 'castMember', 'key'],
    idGenerator: context.idGenerator,
    generatedIds: context.generatedIds,
  });
  const castMember = toCastMember({ ...operation.castMember, id });
  context.draft.splice(0, context.draft.length, ...applyPlacement(context.draft, castMember, operation.placement));
  context.changes.push({ operation: operation.operation, castMemberId: id });
};

export const updateCastMember: CastOperationHandler<'castMember.update'> = (context, operation, path) => {
  assertExistingObjectUsesId({
    id: operation.castMember.id,
    key: operation.castMember.key,
    path: [...path, 'castMember'],
    label: 'cast member',
    issues: context.issues,
  });
  const id = operation.castMember.id;
  const index = id ? context.draft.findIndex((castMember) => castMember.id === id) : -1;
  if (id && index === -1) {
    context.issues.push(notFoundIssue('cast member', [...path, 'castMember', 'id']));
    return;
  }
  if (id && index !== -1) {
    context.draft[index] = toCastMember(operation.castMember);
    context.changes.push({ operation: operation.operation, castMemberId: id });
  }
};

export const moveCastMember: CastOperationHandler<'castMember.move'> = (context, operation) => {
  context.draft.splice(
    0,
    context.draft.length,
    ...moveByPlacement(context.draft, operation.castMemberId, operation.placement, 'Cast member')
  );
  context.changes.push({ operation: operation.operation, castMemberId: operation.castMemberId });
};
