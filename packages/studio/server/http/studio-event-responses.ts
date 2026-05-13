import type {
  StudioCurrent,
  StudioEventReadResult,
} from '@gorenku/studio-core/server';

export function toStudioEventReadResponse(result: StudioEventReadResult) {
  return {
    events: result.events,
    nextCursor: result.nextCursor,
    warnings: result.warnings,
  };
}

export function toStudioCurrentResponse(current: StudioCurrent): StudioCurrent {
  return current;
}
