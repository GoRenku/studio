import { text } from 'drizzle-orm/sqlite-core';

export function discardLifecycleColumns() {
  return {
    discardedAt: text('discarded_at'),
    discardOperationId: text('discard_operation_id'),
    restoredAt: text('restored_at'),
  };
}
