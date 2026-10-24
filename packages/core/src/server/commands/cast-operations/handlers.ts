import type { CastOperation } from '../../../client/department-design.js';
import { addCastMember, moveCastMember, updateCastMember } from './add-update-move.js';
import type { CastOperationContext, CastOperationHandler } from './context.js';
import { deleteCastMember } from './delete.js';

const CAST_OPERATION_HANDLERS: { [K in CastOperation['operation']]: CastOperationHandler<K> } = {
  'castMember.add': addCastMember,
  'castMember.update': updateCastMember,
  'castMember.delete': deleteCastMember,
  'castMember.move': moveCastMember,
};

export function applyCastOperation(context: CastOperationContext, operation: CastOperation, path: string[]): void {
  const handler = CAST_OPERATION_HANDLERS[operation.operation] as CastOperationHandler<CastOperation['operation']>;
  handler(context, operation as never, path);
}
