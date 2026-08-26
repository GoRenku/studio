import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { CastMember } from '../../client/cast-members.js';
import type {
  MediaGenerationCastContext,
  MediaGenerationLocationContext,
  MediaGenerationPropContext,
  MediaGenerationSceneContext,
  ReadMediaGenerationContextInput,
} from '../../client/media-generation-context.js';
import type { Location } from '../../client/locations.js';
import type { Prop } from '../../client/props.js';
import type { Scene, Screenplay } from '../../client/screenplay/index.js';
import { listAssetsInSession } from '../assets/projection.js';
import { readActiveCastDesignDocument, toCastDesignSummary } from '../database/access/cast-designs.js';
import { listCastMemberRecords, type CastMemberRecord } from '../database/access/cast-members.js';
import { readActiveLocationDesignDocument, toLocationDesignSummary } from '../database/access/location-designs.js';
import { listLocationRecords, type LocationRecord } from '../database/access/locations.js';
import { readActivePropDesignDocument, toPropDesignSummary } from '../database/access/prop-designs.js';
import { listPropRecords, type PropRecord } from '../database/access/props.js';
import {
  readActiveSceneBeatsRevisionRecord,
  readSceneBeats,
  readSceneBeatsRevisionRecord,
  toSceneBeatsRevisionSummary,
} from '../database/access/scene-beats.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { listSceneDialogueTurns } from '../scene-dialogue-audio-workspace/turns.js';
import { renderScreenplaySceneContextText } from '../screenplay/context/scene-text.js';

export function projectMediaGenerationSceneContext(input: {
  session: DatabaseSession;
  screenplay: Screenplay;
  sceneId: string;
  scope?: ReadMediaGenerationContextInput['sceneStoryboardScope'];
  warnings: DiagnosticIssue[];
}): MediaGenerationSceneContext {
  const scene = requireScene(input.screenplay, input.sceneId);
  const sceneBeatsRevision = readScopedRevision(input);
  const selectedBeats = sceneBeatsRevision
    ? selectBeats(sceneBeatsRevision.sceneBeats.beats, input.scope?.beatIds ?? [], input.sceneId)
    : [];
  const selectedBeatIds = selectedBeats.map((beat) => beat.id);
  const subjectIds = collectSubjectIds(input.screenplay, scene, selectedBeats);
  const castRecords = new Map(listCastMemberRecords(input.session).map((record) => [record.id, record]));
  const locationRecords = new Map(listLocationRecords(input.session).map((record) => [record.id, record]));
  const propRecords = new Map(listPropRecords(input.session).map((record) => [record.id, record]));
  const castMembers = subjectIds.castMemberIds
    .flatMap((id) => {
      const record = castRecords.get(id);
      return record && !record.isVoiceOver ? [projectCastMemberContext(input.session, record)] : [];
    });
  const locations = subjectIds.locationIds
    .flatMap((id) => {
      const record = locationRecords.get(id);
      return record ? [projectLocationContext(input.session, record)] : [];
    });
  const props = subjectIds.propIds
    .flatMap((id) => {
      const record = propRecords.get(id);
      return record ? [projectPropContext(input.session, record)] : [];
    });
  return {
    kind: 'scene',
    scene,
    contextText: renderScreenplaySceneContextText({ scene, screenplay: input.screenplay }),
    sceneBeatsRevision,
    selectedBeatIds,
    castMembers,
    locations,
    props,
    dialogueTurns: listSceneDialogueTurns(input.screenplay, scene.id).map((turn) => ({
      turnId: turn.turn.id,
      castMemberId: turn.castMemberId,
      speakerName: turn.turn.characterName,
      plainText: turn.plainText,
    })),
  };
}

export function projectCastMemberContext(
  session: DatabaseSession,
  record: CastMemberRecord,
): MediaGenerationCastContext {
  const activeDesign = readActiveCastDesignDocument(session, record.id);
  return {
    castMember: toCastMember(record),
    activeDesign: activeDesign?.document ?? null,
    activeDesignSummary: activeDesign
      ? toCastDesignSummary({ id: activeDesign.id, document: activeDesign.document })
      : null,
    assets: listAssetsInSession(session, { owner: { kind: 'castMember', id: record.id } }),
  };
}

export function projectLocationContext(
  session: DatabaseSession,
  record: LocationRecord,
): MediaGenerationLocationContext {
  const activeDesign = readActiveLocationDesignDocument(session, record.id);
  return {
    location: toLocation(record),
    activeDesign: activeDesign?.document ?? null,
    activeDesignSummary: activeDesign
      ? toLocationDesignSummary({ id: activeDesign.id, document: activeDesign.document })
      : null,
    assets: listAssetsInSession(session, { owner: { kind: 'location', id: record.id } }),
  };
}

export function projectPropContext(
  session: DatabaseSession,
  record: PropRecord,
): MediaGenerationPropContext {
  const activeDesign = readActivePropDesignDocument(session, record.id);
  return {
    prop: toProp(record),
    activeDesign: activeDesign?.document ?? null,
    activeDesignSummary: activeDesign
      ? toPropDesignSummary({ id: activeDesign.id, document: activeDesign.document })
      : null,
    assets: listAssetsInSession(session, { owner: { kind: 'prop', id: record.id } }),
  };
}

export function scenesForSubject(
  screenplay: Screenplay,
  subject: { type: 'castMember' | 'location' | 'prop'; id: string },
): Scene[] {
  const sceneIds = new Set(screenplay.references.flatMap((reference) =>
    reference.subject.type === subject.type
    && reference.subject.id === subject.id
    && 'sceneId' in reference.target
      ? [reference.target.sceneId]
      : []
  ));
  return screenplay.scenes.filter((scene) => sceneIds.has(scene.id));
}

function readScopedRevision(input: {
  session: DatabaseSession;
  sceneId: string;
  scope?: ReadMediaGenerationContextInput['sceneStoryboardScope'];
  warnings: DiagnosticIssue[];
}) {
  const row = input.scope?.sceneBeatsRevisionId
    ? readSceneBeatsRevisionRecord(input.session, input.scope.sceneBeatsRevisionId)
    : readActiveSceneBeatsRevisionRecord(input.session, input.sceneId);
  if (input.scope?.sceneBeatsRevisionId && (!row || row.sceneId !== input.sceneId)) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID',
      'The requested Scene Beats revision does not belong to the target Scene.',
    );
  }
  if (!row) {
    if ((input.scope?.beatIds.length ?? 0) > 0) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID',
        `Requested Beats cannot be resolved because Scene ${input.sceneId} has no active Scene Beats revision.`,
      );
    }
    input.warnings.push(createDiagnosticWarning(
      'CORE_MEDIA_GENERATION_CONTEXT_GAP',
      `No active Scene Beats revision is available for Scene ${input.sceneId}.`,
      { path: ['targetContext', 'sceneBeatsRevision'] },
      'The context is still usable; create Scene Beats only when they are useful for this generation.',
    ));
    return null;
  }
  const active = readActiveSceneBeatsRevisionRecord(input.session, input.sceneId);
  return {
    revision: toSceneBeatsRevisionSummary({ row, activeRevisionId: active?.id ?? null }),
    sceneBeats: readSceneBeats({ row }),
  };
}

function selectBeats<TBeat extends { id: string }>(
  beats: TBeat[],
  requestedIds: string[],
  sceneId: string,
): TBeat[] {
  if (requestedIds.length === 0) {
    return beats;
  }
  const requested = new Set(requestedIds);
  const unknown = [...requested].filter((id) => !beats.some((beat) => beat.id === id));
  if (unknown.length > 0) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_SCOPE_INVALID',
      `Requested Beats are not present in the Scene ${sceneId} revision: ${unknown.join(', ')}.`,
    );
  }
  return beats.filter((beat) => requested.has(beat.id));
}

function collectSubjectIds(
  screenplay: Screenplay,
  scene: Scene,
  beats: Array<{ castMemberIds: string[]; locationIds: string[]; propIds: string[] }>,
) {
  const castMemberIds: string[] = [];
  const locationIds: string[] = [];
  const propIds: string[] = [];
  screenplay.references.forEach((reference) => {
    if (!('sceneId' in reference.target) || reference.target.sceneId !== scene.id) {
      return;
    }
    if (reference.subject.type === 'castMember') {
      appendUnique(castMemberIds, reference.subject.id);
    }
    if (reference.subject.type === 'location') {
      appendUnique(locationIds, reference.subject.id);
    }
    if (reference.subject.type === 'prop') {
      appendUnique(propIds, reference.subject.id);
    }
  });
  beats.forEach((beat) => {
    beat.castMemberIds.forEach((id) => appendUnique(castMemberIds, id));
    beat.locationIds.forEach((id) => appendUnique(locationIds, id));
    beat.propIds.forEach((id) => appendUnique(propIds, id));
  });
  return { castMemberIds, locationIds, propIds };
}

function appendUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function requireScene(screenplay: Screenplay, sceneId: string): Scene {
  const scene = screenplay.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND',
      `Media generation target Scene was not found: ${sceneId}.`,
    );
  }
  return scene;
}

function toCastMember(record: CastMemberRecord): CastMember {
  return {
    id: record.id,
    handle: record.handle,
    name: record.name,
    ...(record.role ? { role: record.role } : {}),
    isVoiceOver: record.isVoiceOver,
    ...(record.age !== null ? { age: record.age } : {}),
    ...(record.want ? { want: record.want } : {}),
    ...(record.need ? { need: record.need } : {}),
    ...(record.arc ? { arc: record.arc } : {}),
    ...(record.voiceNotes ? { voiceNotes: record.voiceNotes } : {}),
    ...(record.description ? { description: record.description } : {}),
  };
}

function toLocation(record: LocationRecord): Location {
  return {
    id: record.id,
    handle: record.handle,
    name: record.name,
    ...(record.timePeriod ? { timePeriod: record.timePeriod } : {}),
    ...(record.description ? { description: record.description } : {}),
    ...(record.visualNotes ? { visualNotes: record.visualNotes } : {}),
  };
}

function toProp(record: PropRecord): Prop {
  return {
    id: record.id,
    handle: record.handle,
    name: record.name,
    ...(record.description ? { description: record.description } : {}),
    ...(record.visualNotes ? { visualNotes: record.visualNotes } : {}),
  };
}
