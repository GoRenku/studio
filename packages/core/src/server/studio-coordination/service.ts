import crypto from 'node:crypto';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import {
  STUDIO_COORDINATION_EVENT_VERSION,
  type AppendStudioEventInput,
  type ReadStudioEventsInput,
  type StudioCurrent,
  type StudioEvent,
  type StudioEventReadResult,
} from './events.js';
import { appendStudioEventToStore, readStudioEventsFromStore } from './event-store.js';
import { validateStudioEvent } from './event-validation.js';
import { projectStudioCurrent } from './current-projection.js';

export interface StudioCoordinationService {
  appendStudioEvent(input: AppendStudioEventInput): Promise<StudioEvent>;
  readStudioEvents(input?: ReadStudioEventsInput): Promise<StudioEventReadResult>;
  readStudioCurrent(): Promise<StudioCurrent>;
}

export function createStudioCoordinationService(
  options: RenkuConfigPathOptions = {}
): StudioCoordinationService {
  return {
    async appendStudioEvent(input) {
      const event = validateStudioEvent({
        ...input,
        id: `studio_event_${crypto.randomUUID()}`,
        version: STUDIO_COORDINATION_EVENT_VERSION,
        createdAt: input.createdAt ?? new Date().toISOString(),
      });
      await appendStudioEventToStore(event, options);
      return event;
    },
    async readStudioEvents(input = {}) {
      return await readStudioEventsFromStore({ ...options, ...input });
    },
    async readStudioCurrent() {
      const result = await readStudioEventsFromStore(options);
      return await projectStudioCurrent({
        ...options,
        events: result.events,
        warnings: result.warnings,
      });
    },
  };
}

export function createStudioOperationId(): string {
  return `studio_operation_${crypto.randomUUID()}`;
}
