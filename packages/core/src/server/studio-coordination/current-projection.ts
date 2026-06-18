import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../renku-config.js';
import { createProjectDataService } from '../project-data-service.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  ScenePanelTab,
  SceneShot,
  SceneShotDetailTab,
} from '../../client/index.js';
import {
  CAMERA_ANGLE_LABELS,
  FOCUS_LABELS,
  LENS_LABELS,
  MOVE_DIRECTION_LABELS,
  MOVE_TRACK_LABELS,
  MOVEMENT_LABELS,
  RIG_LABELS,
  SHOT_SIZE_LABELS,
  SUBJECT_FRAMING_LABELS,
} from '../../client/shot-spec-labels.js';
import { studioCoordinationWarning } from './errors.js';
import { isStudioRuntimeDescriptorUsable, readStudioRuntimeDescriptor } from './runtime-descriptor.js';
import { resolveStudioSelectionForProject } from './focus-validation.js';
import type {
  StudioSelection,
  StudioBrowserSessionActiveEvent,
  StudioCurrent,
  StudioCurrentContext,
  StudioCurrentShotTabSelections,
  StudioEvent,
  StudioFocusChangedEvent,
  StudioFocusRequestedEvent,
  StudioProjectRef,
} from './events.js';

const BROWSER_SESSION_STALE_AFTER_MS = 45_000;
const FOCUS_REQUEST_STALE_AFTER_MS = 5 * 60_000;

export interface ProjectStudioCurrentInput extends RenkuConfigPathOptions {
  events: StudioEvent[];
  warnings: StudioCurrent['warnings'];
  now?: Date;
}

export async function projectStudioCurrent(
  input: ProjectStudioCurrentInput
): Promise<StudioCurrent> {
  const now = input.now ?? new Date();
  const runtime = await readStudioRuntimeDescriptor(input);
  const runtimeActive = Boolean(
    runtime && isStudioRuntimeDescriptorUsable(runtime, now)
  );
  const sessionActivity = new Map<string, StudioBrowserSessionActiveEvent>();
  const sessionFocus = new Map<string, StudioFocusChangedEvent>();
  const appliedRequests = new Set<string>();
  const failedRequests = new Set<string>();
  let latestFocusRequest: StudioFocusRequestedEvent | null = null;

  for (const event of input.events) {
    if (event.type === 'studio.browserSessionActive') {
      sessionActivity.set(event.browserSessionId, event);
    }
    if (event.type === 'studio.focusChanged') {
      const browserSessionId = event.source.kind === 'studio'
        ? event.source.browserSessionId
        : undefined;
      if (browserSessionId) {
        sessionFocus.set(browserSessionId, event);
        sessionActivity.set(browserSessionId, {
          ...event,
          type: 'studio.browserSessionActive',
          browserSessionId,
        });
      }
      if (event.appliedRequestId) {
        appliedRequests.add(event.appliedRequestId);
      }
    }
    if (event.type === 'studio.focusRequestFailed') {
      failedRequests.add(event.requestEventId);
    }
    if (event.type === 'studio.focusRequested') {
      latestFocusRequest = event;
    }
  }

  const latestFocusRequestIsResolved = latestFocusRequest
    ? appliedRequests.has(latestFocusRequest.id) ||
      failedRequests.has(latestFocusRequest.id)
    : false;
  const latestFocusRequestIsFresh = latestFocusRequest
    ? now.getTime() - Date.parse(latestFocusRequest.createdAt) <=
      FOCUS_REQUEST_STALE_AFTER_MS
    : false;
  const latestPendingRequest =
    latestFocusRequest &&
    !latestFocusRequestIsResolved &&
    latestFocusRequestIsFresh
      ? latestFocusRequest
      : null;
  const latestStaleRequest =
    latestFocusRequest &&
    !latestFocusRequestIsResolved &&
    !latestFocusRequestIsFresh
      ? latestFocusRequest
      : null;

  const warnings = [...input.warnings];
  if (!latestPendingRequest && latestStaleRequest) {
    warnings.push(
      studioCoordinationWarning(
        'STUDIO_COORDINATION020',
        'A previous Studio focus request was ignored because it is stale.',
        ['pendingRequest'],
        'Ask the user which project or selection they want to target.'
      )
    );
  }

  const currentSessionId = findMostRecentLiveSessionId(sessionActivity, now);
  const running = runtimeActive || currentSessionId !== null;

  const base: StudioCurrent = {
    studio: { running },
    project: null,
    selection: null,
    context: null,
    pendingRequest: latestPendingRequest
      ? {
          eventId: latestPendingRequest.id,
          projectRef: latestPendingRequest.projectRef,
          focus: latestPendingRequest.focus,
          refresh: latestPendingRequest.refresh,
          createdAt: latestPendingRequest.createdAt,
        }
      : null,
    warnings,
  };

  if (!running) {
    return base;
  }

  if (!currentSessionId) {
    return base;
  }
  const focusEvent = sessionFocus.get(currentSessionId);
  if (!focusEvent || focusEvent.focus.screen !== 'movieStudio' || !focusEvent.projectRef) {
    return base;
  }

  const enriched = await enrichMovieStudioFocus(focusEvent.projectRef, focusEvent.focus.selection, input);
  return {
    ...base,
    project: enriched.project,
    selection: focusEvent.focus.selection,
    context: enriched.context,
    warnings: [...base.warnings, ...enriched.warnings],
  };
}

function findMostRecentLiveSessionId(
  activity: Map<string, StudioBrowserSessionActiveEvent>,
  now: Date
): string | null {
  let result: StudioBrowserSessionActiveEvent | null = null;
  for (const event of activity.values()) {
    if (now.getTime() - Date.parse(event.createdAt) > BROWSER_SESSION_STALE_AFTER_MS) {
      continue;
    }
    if (!result || Date.parse(event.createdAt) >= Date.parse(result.createdAt)) {
      result = event;
    }
  }
  return result?.browserSessionId ?? null;
}

async function enrichMovieStudioFocus(
  projectRef: StudioProjectRef,
  selection: StudioSelection,
  options: RenkuConfigPathOptions
) {
  const warnings: DiagnosticIssue[] = [];
  const storageRoot = await resolveRenkuStorageRoot(options);
  if (storageRoot !== projectRef.storageRoot) {
    warnings.push(
      studioCoordinationWarning(
        'STUDIO_COORDINATION011',
        'Current project reference no longer matches the configured storage root.',
        ['project'],
        'Select the project again before acting on this Studio context.'
      )
    );
    return { project: null, context: null, warnings };
  }
  const projectData = createProjectDataService();
  const project = await projectData.readProject({
    projectName: projectRef.name,
    homeDir: options.homeDir,
  });
  if (project.identity.id !== projectRef.id) {
    warnings.push(
      studioCoordinationWarning(
        'STUDIO_COORDINATION012',
        'Current project reference no longer matches the project database.',
        ['project'],
        'Select the project again before acting on this Studio context.'
      )
    );
    return { project: null, context: null, warnings };
  }

  const resolution = resolveStudioSelectionForProject(project, selection);
  let context: StudioCurrentContext | null = resolution.ok ? resolution.context : null;
  if (resolution.ok && context?.kind === 'scene') {
    const enriched = await enrichSceneShotFocusContext({
      projectData,
      projectName: project.identity.name,
      selection,
      context,
      options,
    });
    context = enriched.context;
    warnings.push(...enriched.warnings);
  }
  return {
    project: {
      name: project.identity.name,
      id: project.identity.id,
      title: project.identity.title,
    },
    context,
    warnings: resolution.ok ? warnings : [...warnings, ...resolution.diagnostics],
  };
}

async function enrichSceneShotFocusContext(input: {
  projectData: ReturnType<typeof createProjectDataService>;
  projectName: string;
  selection: StudioSelection;
  context: Extract<StudioCurrentContext, { kind: 'scene' }>;
  options: RenkuConfigPathOptions;
}): Promise<{
  context: Extract<StudioCurrentContext, { kind: 'scene' }>;
  warnings: DiagnosticIssue[];
}> {
  if (input.selection.type !== 'scene') {
    return { context: input.context, warnings: [] };
  }
  const selection = input.selection;
  const sceneTab = effectiveSceneTab(selection);
  const baseContext = {
    ...input.context,
    sceneTab: sceneTabLabel(sceneTab),
  };
  if (sceneTab !== 'shots' && sceneTab !== 'takes') {
    return { context: baseContext, warnings: [] };
  }
  try {
    const resource = await input.projectData.readSceneShotListResource({
      projectName: input.projectName,
      sceneId: selection.id,
      homeDir: input.options.homeDir,
    });
    const shots = resource.activeShotList?.shots ?? [];
    const shotIndex = selection.shotId
      ? shots.findIndex((shot) => shot.shotId === selection.shotId)
      : shots.length > 0
        ? 0
        : -1;
    if (shotIndex < 0) {
      return {
        context: baseContext,
        warnings: selection.shotId
          ? [
              studioCoordinationWarning(
                'STUDIO_COORDINATION038',
                'Current Studio shot focus no longer exists in the active shot list.',
                ['selection', 'shotId'],
                'Select a shot that exists in the scene active shot list.'
              ),
            ]
          : [],
      };
    }
    const shot = shots[shotIndex]!;
    const shotTab = selection.shotTab ?? 'description';
    const shotTabProjection = await shotTabSelections({
      projectData: input.projectData,
      projectName: input.projectName,
      homeDir: input.options.homeDir,
      sceneId: selection.id,
      takeGenerationId: selection.takeGenerationId,
      shot,
      shotTab,
      castMemberLabels: resource.castMemberLabels,
      locationLabels: resource.locationLabels,
    });
    return {
      context: {
        ...baseContext,
        shot: {
          id: shot.shotId,
          index: shotIndex,
          label: `Shot ${shotIndex + 1}`,
          title: shot.title,
          activeTab: shotTabLabel(shotTab),
          currentTabSelections: shotTabProjection.selections,
        },
      },
      warnings: shotTabProjection.warnings,
    };
  } catch {
    return {
      context: baseContext,
      warnings: [
        studioCoordinationWarning(
          'STUDIO_COORDINATION039',
          'Current Studio shot focus could not load the active shot list.',
          ['context', 'shot'],
          'Refresh Studio and try reading current focus again.'
        ),
      ],
    };
  }
}

function effectiveSceneTab(selection: Extract<StudioSelection, { type: 'scene' }>): ScenePanelTab {
  return selection.sceneTab ?? (selection.shotId || selection.shotTab ? 'takes' : 'narrative');
}

function sceneTabLabel(tab: ScenePanelTab) {
  return {
    id: tab,
    label:
      tab === 'takes' ? 'Takes' : tab === 'shots' ? 'Shots' : 'Narrative',
  };
}

function shotTabLabel(tab: SceneShotDetailTab) {
  switch (tab) {
    case 'description':
      return { id: tab, label: 'Description' };
    case 'lookbook':
      return { id: tab, label: 'Lookbook' };
    case 'composition':
      return { id: tab, label: 'Composition' };
    case 'motion':
      return { id: tab, label: 'Motion' };
    case 'dialogs':
      return { id: tab, label: 'Dialogs' };
    case 'cast':
      return { id: tab, label: 'Cast' };
    case 'location':
      return { id: tab, label: 'Location' };
    case 'references':
      return { id: tab, label: 'References' };
    case 'ai-production':
      return { id: tab, label: 'AI Production' };
  }
}

async function shotTabSelections(input: {
  projectData: ReturnType<typeof createProjectDataService>;
  projectName: string;
  homeDir?: string;
  sceneId: string;
  takeGenerationId?: string;
  shot: SceneShot;
  shotTab: SceneShotDetailTab;
  castMemberLabels: Record<string, string>;
  locationLabels: Record<string, string>;
}): Promise<{
  selections: StudioCurrentShotTabSelections;
  warnings: DiagnosticIssue[];
}> {
  const shotSpecs = input.shot.shotSpecs;
  switch (input.shotTab) {
    case 'composition':
      return {
        selections: {
          kind: 'composition',
        ...(shotSpecs?.shotSize
          ? {
              shotSize: {
                id: shotSpecs.shotSize,
                label: SHOT_SIZE_LABELS[shotSpecs.shotSize],
              },
            }
          : {}),
        subjectFraming: (shotSpecs?.subjectFraming ?? []).map((id) => ({
          id,
          label: SUBJECT_FRAMING_LABELS[id],
        })),
        ...(shotSpecs?.cameraAngle
          ? {
              cameraAngle: {
                id: shotSpecs.cameraAngle,
                label: CAMERA_ANGLE_LABELS[shotSpecs.cameraAngle],
              },
            }
          : {}),
        ...(shotSpecs?.dutch ? { dutch: shotSpecs.dutch } : {}),
          ...compositionLens(shotSpecs),
          ...(shotSpecs?.custom?.composition?.trim()
            ? { customComposition: shotSpecs.custom.composition.trim() }
            : {}),
        },
        warnings: [],
      };
    case 'motion':
      return {
        selections: {
          kind: 'motion',
        ...(shotSpecs?.movement?.movement
          ? {
              movement: {
                id: shotSpecs.movement.movement,
                label: MOVEMENT_LABELS[shotSpecs.movement.movement],
              },
            }
          : {}),
        ...(shotSpecs?.movement?.secondary
          ? {
              secondary: {
                id: shotSpecs.movement.secondary,
                label: MOVEMENT_LABELS[shotSpecs.movement.secondary],
              },
            }
          : {}),
        directions: (shotSpecs?.movement?.directions ?? []).map((id) => ({
          id,
          label: MOVE_DIRECTION_LABELS[id],
        })),
        ...(shotSpecs?.movement?.track
          ? {
              track: {
                id: shotSpecs.movement.track,
                label: MOVE_TRACK_LABELS[shotSpecs.movement.track],
              },
            }
          : {}),
        ...(shotSpecs?.movement?.rig
          ? {
              rig: {
                id: shotSpecs.movement.rig,
                label: RIG_LABELS[shotSpecs.movement.rig],
              },
            }
          : {}),
          ...(shotSpecs?.custom?.movement?.trim()
            ? { customMotion: shotSpecs.custom.movement.trim() }
            : {}),
        },
        warnings: [],
      };
    case 'cast': {
      const castMemberIds =
        shotSpecs?.castReferences?.castMemberIds ?? input.shot.castMemberIds;
      return {
        selections: {
          kind: 'cast',
          cast: castMemberIds.map((id) => ({
            id,
            name: input.castMemberLabels[id] ?? id,
          })),
        },
        warnings: [],
      };
    }
    case 'location': {
      const locationIds = shotSpecs?.location?.locationId
        ? [shotSpecs.location.locationId]
        : input.shot.locationIds;
      return {
        selections: {
          kind: 'location',
          locations: locationIds.map((id) => ({
            id,
            name: input.locationLabels[id] ?? id,
          })),
        },
        warnings: [],
      };
    }
    case 'ai-production': {
      const fallback = {
        kind: 'take-generation' as const,
        ...(input.takeGenerationId
          ? { takeGenerationId: input.takeGenerationId }
          : {}),
        shotIds: [input.shot.shotId],
      };
      if (!input.takeGenerationId) {
        return { selections: fallback, warnings: [] };
      }
      try {
        const takeGeneration = await input.projectData.readSceneShotVideoTakeGeneration({
          projectName: input.projectName,
          homeDir: input.homeDir,
          takeGenerationId: input.takeGenerationId,
        });
        if (takeGeneration.sceneId !== input.sceneId) {
          return {
            selections: fallback,
            warnings: [
              studioCoordinationWarning(
                'STUDIO_COORDINATION040',
                'Current Studio take generation focus belongs to a different scene.',
                ['selection', 'takeGenerationId'],
                'Refresh Studio and select a take generation in the current scene.'
              ),
            ],
          };
        }
        return {
          selections: {
            kind: 'take-generation',
            takeGenerationId: takeGeneration.takeGenerationId,
            shotIds: takeGeneration.shotIds,
          },
          warnings: [],
        };
      } catch {
        return {
          selections: fallback,
          warnings: [
            studioCoordinationWarning(
              'STUDIO_COORDINATION041',
              'Current Studio take generation focus could not load.',
              ['selection', 'takeGenerationId'],
              'Refresh Studio and select an existing take generation.'
            ),
          ],
        };
      }
    }
    case 'description':
    case 'lookbook':
    case 'dialogs':
    case 'references':
      return { selections: { kind: input.shotTab }, warnings: [] };
  }
}

function compositionLens(shotSpecs: SceneShot['shotSpecs']) {
  const lens = shotSpecs?.lens;
  if (!lens?.type && !lens?.focus && lens?.millimeters === undefined) {
    return {};
  }
  return {
    lens: {
      ...(lens.type
        ? {
            type: {
              id: lens.type,
              label: LENS_LABELS[lens.type],
            },
          }
        : {}),
      ...(lens.millimeters !== undefined ? { millimeters: lens.millimeters } : {}),
      ...(lens.focus
        ? {
            focus: {
              id: lens.focus,
              label: FOCUS_LABELS[lens.focus],
            },
          }
        : {}),
    },
  };
}
