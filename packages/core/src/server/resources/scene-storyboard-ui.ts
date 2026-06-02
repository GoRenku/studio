import type {
  ActStoryboardResource,
  ActStoryboardScene,
  ActStoryboardSequence,
  ActStoryboardShot,
  Asset,
  SceneShotListResource,
  SceneStoryboardSheetReference,
  ScreenplayImageReference,
} from '../../client/index.js';
import type {
  SceneShot,
  SceneShotListDocument,
  ShotSpecs,
} from '../../client/scene-shot-list.js';
import { deriveShotSpecPromptStrings } from '../../client/shot-spec-labels.js';
import { ProjectDataError } from '../project-data-error.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import {
  listSceneNavigationPage,
  listSequenceNavigationPage,
  readActNavigationRow,
  readSceneNavigationContext,
} from '../database/access/navigation.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  listSceneShotStoryboardImageRecords,
  listSceneShotStoryboardSheetRecords,
  readActiveSceneShotListRecord,
  readSceneShotListDocument,
  updateSceneShotListRecordDocument,
} from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  ReadActStoryboardResourceInput,
  ReadSceneShotListResourceInput,
  UpdateSceneShotSpecsInput,
} from '../project-data-service-contracts.js';

export async function readSceneShotListResource(
  input: ReadSceneShotListResourceInput
): Promise<SceneShotListResource> {
  const { session } = await openProjectSession(input);
  try {
    const context = readSceneNavigationContext(session, input.sceneId);
    if (!context) {
      throwNotFound('scene', input.sceneId);
    }
    const act = readActNavigationRow(session, context.sequence.actId);
    if (!act) {
      throwNotFound('act', context.sequence.actId);
    }
    const projection = readSceneStoryboardProjection(session, input.sceneId);
    const screenplay = readScreenplayDocumentFromSession(session);
    return {
      scene: context.scene,
      sequence: context.sequence,
      act,
      projectAspectRatio: readProjectRecord(session)?.aspectRatio ?? null,
      activeShotListId:
        readActiveSceneShotListRecord(session, input.sceneId)?.id ?? null,
      activeShotList: projection.document,
      storyboardSheet: projection.sheetReference,
      storyboardImagesByShotId: projection.imagesByShotId,
      castMemberLabels: screenplay
        ? Object.fromEntries(
            screenplay.cast.map((castMember) => [castMember.id, castMember.name])
          )
        : {},
      locationLabels: screenplay
        ? Object.fromEntries(
            screenplay.locations.map((location) => [location.id, location.name])
          )
        : {},
    };
  } finally {
    session.close();
  }
}

/**
 * In-place update of a single shot's structured shot specs on the scene's
 * active shot list (0036). Re-derives the prompt-facing free-text strings,
 * revalidates the whole document, and writes it back without creating a new
 * history row. Returns the refreshed shot-list resource for the active surface.
 */
export async function updateSceneShotSpecs(
  input: UpdateSceneShotSpecsInput
): Promise<SceneShotListResource> {
  const { session } = await openProjectSession(input);
  try {
    const shotListRow = readActiveSceneShotListRecord(session, input.sceneId);
    if (!shotListRow) {
      throw new ProjectDataError(
        'PROJECT_DATA329',
        `Scene has no active shot list to update: ${input.sceneId}.`,
        {
          suggestion:
            'Create or activate a shot list for this scene before editing shot specs.',
        }
      );
    }
    const screenplay = requireScreenplayDocument(session);
    const document = readSceneShotListDocument({
      row: shotListRow,
      screenplay,
    });
    const shot = document.shots.find((entry) => entry.shotId === input.shotId);
    if (!shot) {
      throw new ProjectDataError(
        'PROJECT_DATA330',
        `Shot was not found in the active shot list: ${input.shotId}.`,
        { suggestion: 'Use a shot id from the active shot list.' }
      );
    }
    applyShotSpecs(shot, input.shotSpecs);
    const now = new Date().toISOString();
    updateSceneShotListRecordDocument({
      session,
      id: shotListRow.id,
      document,
      screenplay,
      now,
    });
  } finally {
    session.close();
  }
  return readSceneShotListResource({
    projectName: input.projectName,
    sceneId: input.sceneId,
    homeDir: input.homeDir,
  });
}

function applyShotSpecs(
  shot: SceneShot,
  shotSpecs: ShotSpecs | null
): void {
  const previous = shot.shotSpecs;
  const normalized = normalizeShotSpecs(shotSpecs);
  if (normalized) {
    shot.shotSpecs = normalized;
  } else {
    delete shot.shotSpecs;
  }

  // Derive prompt-facing strings for axes owned by the structured specs. When
  // a previously specified axis is removed, clear its old derived text so stale
  // selections do not leak into generation prompts.
  const derived = deriveShotSpecPromptStrings(shot.shotSpecs);
  if (derived.shotType !== undefined) {
    shot.shotType = derived.shotType;
  } else if (hasShotSizeSpecs(previous)) {
    shot.shotType = 'Unspecified';
  }
  if (derived.cameraAngle !== undefined) {
    shot.cameraAngle = derived.cameraAngle;
  } else if (hasCameraAngleSpecs(previous)) {
    delete shot.cameraAngle;
  }
  if (derived.framing !== undefined) {
    shot.framing = derived.framing;
  } else if (hasFramingSpecs(previous)) {
    delete shot.framing;
  }
  if (derived.cameraMovement !== undefined) {
    shot.cameraMovement = derived.cameraMovement;
  } else if (hasMovementSpecs(previous)) {
    delete shot.cameraMovement;
  }
  if (derived.lensIntent !== undefined) {
    shot.lensIntent = derived.lensIntent;
  } else if (hasLensIntentSpecs(previous)) {
    delete shot.lensIntent;
  }
}

function hasShotSizeSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  return Boolean(shotSpecs?.shotSize);
}

function hasCameraAngleSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  return Boolean(shotSpecs?.cameraAngle || shotSpecs?.dutch);
}

function hasFramingSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  return Boolean(
    shotSpecs?.subjectFraming?.length || shotSpecs?.custom?.composition?.trim()
  );
}

function hasLensIntentSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  return Boolean(
    shotSpecs?.lens?.type ||
      shotSpecs?.lens?.millimeters !== undefined ||
      shotSpecs?.lens?.focus
  );
}

function hasMovementSpecs(shotSpecs: ShotSpecs | undefined): boolean {
  const movement = shotSpecs?.movement;
  return Boolean(
    movement?.movement ||
      movement?.secondary ||
      movement?.track ||
      movement?.rig ||
      movement?.directions?.length ||
      shotSpecs?.custom?.movement?.trim()
  );
}

/**
 * Drop empty arrays, blank custom strings, and empty nested objects so the
 * stored specs stay minimal and satisfy the non-empty-string schema rules.
 * Returns undefined when nothing meaningful is selected.
 */
function normalizeShotSpecs(
  shotSpecs: ShotSpecs | null
): ShotSpecs | undefined {
  if (!shotSpecs) {
    return undefined;
  }
  const next: ShotSpecs = {};
  if (shotSpecs.shotSize) {
    next.shotSize = shotSpecs.shotSize;
  }
  if (shotSpecs.subjectFraming?.length) {
    next.subjectFraming = [...shotSpecs.subjectFraming];
  }
  if (shotSpecs.cameraAngle) {
    next.cameraAngle = shotSpecs.cameraAngle;
  }
  if (shotSpecs.dutch) {
    next.dutch = shotSpecs.dutch;
  }
  const movement = normalizeMovement(shotSpecs.movement);
  if (movement) {
    next.movement = movement;
  }
  const lens = normalizeLens(shotSpecs.lens);
  if (lens) {
    next.lens = lens;
  }
  const location = normalizeLocation(shotSpecs.location);
  if (location) {
    next.location = location;
  }
  const custom = normalizeCustom(shotSpecs.custom);
  if (custom) {
    next.custom = custom;
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeLens(
  lens: ShotSpecs['lens']
): ShotSpecs['lens'] | undefined {
  if (!lens) {
    return undefined;
  }
  const next: NonNullable<ShotSpecs['lens']> = {};
  if (lens.type) {
    next.type = lens.type;
  }
  if (lens.millimeters !== undefined) {
    next.millimeters = lens.millimeters;
  }
  if (lens.focus) {
    next.focus = lens.focus;
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeLocation(
  location: ShotSpecs['location']
): ShotSpecs['location'] | undefined {
  if (!location) {
    return undefined;
  }
  const next: NonNullable<ShotSpecs['location']> = {};
  const locationId = location.locationId?.trim();
  if (locationId) {
    next.locationId = locationId;
  }
  if (location.usesDifferentLocation !== undefined) {
    next.usesDifferentLocation = location.usesDifferentLocation;
  }
  if (location.azimuthView) {
    next.azimuthView = location.azimuthView;
  }
  const customView = location.customView?.trim();
  if (customView) {
    next.customView = customView;
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeMovement(
  movement: ShotSpecs['movement']
): ShotSpecs['movement'] | undefined {
  if (!movement) {
    return undefined;
  }
  const next: NonNullable<ShotSpecs['movement']> = {};
  if (movement.movement) {
    next.movement = movement.movement;
  }
  if (movement.secondary) {
    next.secondary = movement.secondary;
  }
  if (movement.directions?.length) {
    next.directions = [...movement.directions];
  }
  if (movement.track) {
    next.track = movement.track;
  }
  if (movement.rig) {
    next.rig = movement.rig;
  }
  return Object.keys(next).length ? next : undefined;
}

function normalizeCustom(
  custom: ShotSpecs['custom']
): ShotSpecs['custom'] | undefined {
  if (!custom) {
    return undefined;
  }
  const next: NonNullable<ShotSpecs['custom']> = {};
  const composition = custom.composition?.trim();
  if (composition) {
    next.composition = composition;
  }
  const movement = custom.movement?.trim();
  if (movement) {
    next.movement = movement;
  }
  return Object.keys(next).length ? next : undefined;
}

export async function readActStoryboardResource(
  input: ReadActStoryboardResourceInput
): Promise<ActStoryboardResource> {
  const { session } = await openProjectSession(input);
  try {
    const act = readActNavigationRow(session, input.actId);
    if (!act) {
      throwNotFound('act', input.actId);
    }
    const sequences: ActStoryboardSequence[] = listSequenceNavigationPage(
      session,
      { actId: input.actId, limit: 200 }
    ).items.map((sequence) => ({
      sequence,
      scenes: listSceneNavigationPage(session, {
        sequenceId: sequence.id,
        limit: 200,
      }).items.map((scene) => toActStoryboardScene(session, scene)),
    }));
    return { act, sequences };
  } finally {
    session.close();
  }
}

function toActStoryboardScene(
  session: DatabaseSession,
  scene: ActStoryboardScene['scene']
): ActStoryboardScene {
  const projection = readSceneStoryboardProjection(session, scene.id);
  // An empty `shots` array signals a single scene placeholder slot: render
  // shots only when the scene has an active shot list with imported images.
  if (!projection.document || !projection.sheetReference) {
    return { scene, shots: [] };
  }
  const shots: ActStoryboardShot[] = projection.document.shots.map(
    (shot, index) => ({
      shotId: shot.shotId,
      label: shotLabel(index),
      title: shot.title,
      image: projection.imagesByShotId[shot.shotId] ?? null,
    })
  );
  return { scene, shots };
}

export function readActiveSceneStoryboardSheetImage(
  session: DatabaseSession,
  sceneId: string
): ScreenplayImageReference | null {
  return readSceneStoryboardProjection(session, sceneId).sheetReference?.sheet ?? null;
}

interface SceneStoryboardProjection {
  document: SceneShotListDocument | null;
  sheetReference: SceneStoryboardSheetReference | null;
  imagesByShotId: Record<string, ScreenplayImageReference>;
}

function readSceneStoryboardProjection(
  session: DatabaseSession,
  sceneId: string
): SceneStoryboardProjection {
  const shotListRow = readActiveSceneShotListRecord(session, sceneId);
  if (!shotListRow) {
    return { document: null, sheetReference: null, imagesByShotId: {} };
  }
  const screenplay = requireScreenplayDocument(session);
  const document = readSceneShotListDocument({ row: shotListRow, screenplay });

  // Records are returned newest-first. A single import can produce several sheet
  // records (one compound asset, shots split across sheets), so resolve every
  // sheet that belongs to the most recent import — keyed by its asset id — not
  // just the first sheet record. Otherwise shots living on the other sheets of
  // the same import render as empty placeholders.
  const sheetRecords = listSceneShotStoryboardSheetRecords(
    session,
    shotListRow.id
  );
  const latestSheet = sheetRecords[0];
  if (!latestSheet) {
    return { document, sheetReference: null, imagesByShotId: {} };
  }
  const importSheets = sheetRecords.filter(
    (record) => record.assetId === latestSheet.assetId
  );

  const asset = readAssetRelationship(session, {
    target: { kind: 'scene', sceneId },
    assetId: latestSheet.assetId,
  });
  if (!asset) {
    return { document, sheetReference: null, imagesByShotId: {} };
  }

  const sheet = toImageReferenceForFile(asset, latestSheet.sheetFileId);
  if (!sheet) {
    return { document, sheetReference: null, imagesByShotId: {} };
  }

  const imagesByShotId: Record<string, ScreenplayImageReference> = {};
  for (const sheetRecord of importSheets) {
    for (const image of listSceneShotStoryboardImageRecords(
      session,
      sheetRecord.id
    )) {
      const reference = toImageReferenceForFile(asset, image.assetFileId);
      if (reference) {
        imagesByShotId[image.shotId] = reference;
      }
    }
  }

  return {
    document,
    sheetReference: { shotListId: shotListRow.id, sheet },
    imagesByShotId,
  };
}

function toImageReferenceForFile(
  asset: Asset,
  assetFileId: string
): ScreenplayImageReference | null {
  const file = asset.files.find((candidate) => candidate.id === assetFileId);
  if (!file) {
    return null;
  }
  return {
    assetId: asset.assetId,
    relationshipId: asset.relationshipId,
    assetFileId: file.id,
    title: asset.title,
    fileRole: file.role,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
  };
}

function shotLabel(index: number): string {
  return `Shot ${index + 1}`;
}

function requireScreenplayDocument(session: DatabaseSession) {
  const document = readScreenplayDocumentFromSession(session);
  if (!document) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Create screenplay data before opening this surface.',
    });
  }
  return document;
}

function throwNotFound(label: string, id: string): never {
  throw new ProjectDataError(
    'PROJECT_DATA205',
    `No ${label} was found for this screenplay request: ${id}.`,
    { suggestion: 'Check the id from the latest screenplay resource.' }
  );
}
