export {
  createStudioCoordinationService,
  createStudioOperationId,
  type StudioCoordinationService,
} from './service.js';
export {
  StudioCoordinationError,
} from './errors.js';
export {
  resolveStudioSelectionForProject,
  validateStudioFocusRequestForProject,
} from './focus-validation.js';
export {
  resolveStudioEventStorePath,
} from './event-store.js';
export {
  studioAssetResourceKey,
  studioMarkdownResourceKey,
  studioProjectInformationResourceKey,
  studioProjectShellResourceKey,
  studioResourceKeysForAssetTarget,
  studioSurfaceResourceKeyForAssetTarget,
} from './resource-keys.js';
export {
  STUDIO_RUNTIME_HEARTBEAT_INTERVAL_MS,
  STUDIO_RUNTIME_STALE_AFTER_MS,
  claimStudioRuntimeDescriptor,
  createStudioServerInstanceId,
  heartbeatStudioRuntimeDescriptor,
  isStudioRuntimeDescriptorStale,
  readStudioRuntimeDescriptor,
  releaseStudioRuntimeDescriptor,
  resolveStudioRuntimeDescriptorPath,
  type StudioRuntimeDescriptor,
} from './runtime-descriptor.js';
export type {
  AppendStudioEventInput,
  StudioSelection,
  ProjectInformationRefreshField,
  ReadStudioEventsInput,
  StudioBrowserSessionActiveEvent,
  StudioCurrent,
  StudioCurrentContext,
  StudioCurrentProject,
  StudioEvent,
  StudioEventReadResult,
  StudioEventSource,
  StudioFocus,
  StudioFocusChangedEvent,
  StudioFocusRequest,
  StudioFocusRequestFailedEvent,
  StudioFocusRequestedEvent,
  StudioPendingRequest,
  StudioProjectRef,
  StudioProjectRefreshRequestedEvent,
  StudioProjectResourcesChangedEvent,
  StudioProjectRefreshSurface,
  StudioRefreshRequest,
} from './events.js';
export type {
  StudioSelectionResolution,
  StudioFocusRequestValidation,
} from './focus-validation.js';
