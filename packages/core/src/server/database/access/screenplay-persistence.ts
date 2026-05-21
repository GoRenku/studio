import {
  createDiagnosticError,
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  Block,
  GeneratedId,
  Reference,
  Scene,
  ScreenplayDocument,
  Sequence,
} from '../../../client/screenplay.js';
import {
  acts,
  castAssets,
  castMembers,
  locationAssets,
  locations,
  sceneLocations,
  sceneAssets,
  scenes,
  screenplay,
  sequenceAssets,
  sequences,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type EntityIdPrefix,
  type ProjectIdGenerator,
} from '../../entity-ids.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface ResolvedScreenplayDocument {
  document: ScreenplayDocument;
  generatedIds: GeneratedId[];
  warnings: DiagnosticIssue[];
}

export function resolveScreenplayDocumentIds(input: {
  document: ScreenplayDocument;
  existing?: ScreenplayDocument | null;
  idGenerator?: ProjectIdGenerator;
}): ResolvedScreenplayDocument {
  const document = structuredClone(input.document);
  const generatedIds: GeneratedId[] = [];
  const allocator = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const keys = {
    cast: new Map<string, string>(),
    locations: new Map<string, string>(),
    acts: new Map<string, string>(),
    sequences: new Map<string, string>(),
    scenes: new Map<string, string>(),
  };

  const issues: DiagnosticIssue[] = [];
  const warnings: DiagnosticIssue[] = [];
  assignCollectionIds(document.cast, 'cast', ['cast'], 'cast', keys.cast, generatedIds, allocator, issues);
  assignCollectionIds(document.locations, 'location', ['locations'], 'location', keys.locations, generatedIds, allocator, issues);
  document.acts.forEach((act, actIndex) => {
    assignObjectId(act, 'act', ['acts', String(actIndex)], 'act', keys.acts, generatedIds, allocator, issues);
    act.sequences.forEach((sequence, sequenceIndex) => {
      assignObjectId(sequence, 'sequence', ['acts', String(actIndex), 'sequences', String(sequenceIndex)], 'sequence', keys.sequences, generatedIds, allocator, issues);
      sequence.scenes.forEach((scene, sceneIndex) => {
        assignObjectId(scene, 'scene', ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex)], 'scene', keys.scenes, generatedIds, allocator, issues);
      });
    });
  });

  if (issues.length > 0) {
    throwValidation(issues);
  }

  collectDuplicateIds(document, issues);

  if (issues.length > 0) {
    throwValidation(issues);
  }

  const castIds = new Set(document.cast.map((castMember) => castMember.id ?? ''));
  const locationIds = new Set(document.locations.map((location) => location.id ?? ''));
  validateHandles(document, issues);
  document.acts.forEach((act, actIndex) =>
    act.sequences.forEach((sequence, sequenceIndex) =>
      sequence.scenes.forEach((scene, sceneIndex) => {
        scene.setting.locationIds = scene.setting.locationReferences
          ? resolveRefs(
              scene.setting.locationReferences,
              locationIds,
              keys.locations,
              ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex), 'setting', 'locationReferences'],
              issues,
              warnings
            )
          : validateDurableIds(
              scene.setting.locationIds ?? [],
              locationIds,
              ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex), 'setting', 'locationIds'],
              issues,
              warnings
            );
        delete scene.setting.locationReferences;
        scene.blocks.forEach((block, blockIndex) => {
          const blockPath = ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes', String(sceneIndex), 'blocks', String(blockIndex)];
          block.castMemberIds = block.castMemberReferences
            ? resolveRefs(block.castMemberReferences, castIds, keys.cast, [...blockPath, 'castMemberReferences'], issues, warnings)
            : validateDurableIds(block.castMemberIds ?? [], castIds, [...blockPath, 'castMemberIds'], issues, warnings);
          block.locationIds = block.locationReferences
            ? resolveRefs(block.locationReferences, locationIds, keys.locations, [...blockPath, 'locationReferences'], issues, warnings)
            : validateDurableIds(block.locationIds ?? [], locationIds, [...blockPath, 'locationIds'], issues, warnings);
          delete block.castMemberReferences;
          delete block.locationReferences;
          if (block.type === 'dialogue') {
            block.castMemberId = block.castMemberReference
              ? resolveRef(block.castMemberReference, castIds, keys.cast, [...blockPath, 'castMemberReference'], issues)
              : block.castMemberId;
            delete block.castMemberReference;
          } else {
            validateTextMentions(block.text, document, blockPath, issues);
          }
        });
      })
    )
  );

  if (issues.length > 0) {
    throwValidation(issues);
  }

  return { document, generatedIds, warnings };
}

function validateDurableIds(
  ids: string[],
  durableIds: Set<string>,
  path: string[],
  issues: DiagnosticIssue[],
  warnings: DiagnosticIssue[]
): string[] {
  const resolved: string[] = [];
  ids.forEach((id, index) => {
    if (!durableIds.has(id)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA210',
          'Reference points to an unknown object.',
          { path: [...path, String(index)] },
          'Reference an existing object id.'
        )
      );
      return;
    }
    addUniqueResolvedId(resolved, id, [...path, String(index)], warnings);
  });
  return resolved;
}

function collectDuplicateIds(
  document: ScreenplayDocument,
  issues: DiagnosticIssue[]
): void {
  collectDuplicateIdsInCollection(document.cast, ['cast'], issues);
  collectDuplicateIdsInCollection(document.locations, ['locations'], issues);
  collectDuplicateIdsInCollection(document.acts, ['acts'], issues);
  document.acts.forEach((act, actIndex) => {
    collectDuplicateIdsInCollection(
      act.sequences,
      ['acts', String(actIndex), 'sequences'],
      issues
    );
    act.sequences.forEach((sequence, sequenceIndex) => {
      collectDuplicateIdsInCollection(
        sequence.scenes,
        ['acts', String(actIndex), 'sequences', String(sequenceIndex), 'scenes'],
        issues
      );
    });
  });
}

function collectDuplicateIdsInCollection(
  values: Array<{ id?: string }>,
  path: string[],
  issues: DiagnosticIssue[]
): void {
  const firstPathById = new Map<string, string[]>();
  values.forEach((value, index) => {
    if (!value.id) {
      return;
    }
    const idPath = [...path, String(index), 'id'];
    const firstPath = firstPathById.get(value.id);
    if (firstPath) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA209',
          `Duplicate id: ${value.id}.`,
          { path: idPath, context: `First seen at ${firstPath.join('.')}` },
          'Remove the duplicate or use a different durable id.'
        )
      );
      return;
    }
    firstPathById.set(value.id, idPath);
  });
}

export function replaceScreenplayDocument(session: DatabaseSession, document: ScreenplayDocument): void {
  assertNoScreenplayAssetRelationships(session);
  try {
    session.db.transaction(() => {
      deleteScreenplayTables(session);
      session.db.insert(screenplay).values({
      title: document.screenplay.title,
      intendedAudience: document.screenplay.intendedAudience ?? null,
      targetLengthLabel: document.screenplay.targetLengthLabel ?? null,
      estimatedMinutes: document.screenplay.estimatedMinutes ?? null,
      genrePrimary: document.screenplay.genrePrimary ?? null,
      genreSecondary: stringifyArray(document.screenplay.genreSecondary),
      tone: stringifyArray(document.screenplay.tone),
      ratingIntent: document.screenplay.ratingIntent ?? null,
      boundaries: stringifyArray(document.screenplay.boundaries),
      logline: document.screenplay.logline ?? null,
      summary: document.screenplay.summary ?? null,
      premiseOverview: document.screenplay.premiseOverview ?? null,
      centralConflict: document.screenplay.centralConflict ?? null,
      dramaticQuestion: document.screenplay.dramaticQuestion ?? null,
      themes: stringifyArray(document.screenplay.themes),
      historicalBasis: stringifyArray(document.screenplay.historicalBasis),
      dramatizedElements: stringifyArray(document.screenplay.dramatizedElements),
      structureModel: document.screenplay.structureModel ?? null,
      status: document.screenplay.status ?? null,
      researchSources: stringifyArray(document.screenplay.researchSources),
      assumptionsMade: stringifyArray(document.screenplay.assumptionsMade),
      }).run();

    document.cast.forEach((castMember, index) => {
      session.db.insert(castMembers).values({
        id: requiredId(castMember),
        handle: castMember.handle,
        name: castMember.name,
        role: castMember.role ?? null,
        age: castMember.age ?? null,
        want: castMember.want ?? null,
        need: castMember.need ?? null,
        arc: castMember.arc ?? null,
        voiceNotes: castMember.voiceNotes ?? null,
        description: castMember.description ?? null,
        position: index,
      }).run();
    });

    document.locations.forEach((location, index) => {
      session.db.insert(locations).values({
        id: requiredId(location),
        handle: location.handle,
        name: location.name,
        timePeriod: location.timePeriod ?? null,
        description: location.description ?? null,
        visualNotes: location.visualNotes ?? null,
        position: index,
      }).run();
    });

    document.acts.forEach((act, actIndex) => {
      session.db.insert(acts).values({
        id: requiredId(act),
        title: act.title ?? `Act ${actIndex + 1}`,
        purpose: act.purpose ?? null,
        keyBeats: stringifyArray(act.keyBeats),
        position: actIndex,
      }).run();
      act.sequences.forEach((sequence, sequenceIndex) => {
        session.db.insert(sequences).values({
          id: requiredId(sequence),
          actId: requiredId(act),
          title: sequence.title ?? `Sequence ${sequenceIndex + 1}`,
          purpose: sequence.purpose ?? null,
          position: sequenceIndex,
        }).run();
        sequence.scenes.forEach((scene, sceneIndex) => insertScene(session, sequence, scene, sceneIndex));
      });
    });
    });
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA219',
      error instanceof Error
        ? `Screenplay write failed: ${error.message}`
        : 'Screenplay write failed.',
      {
        suggestion: 'Fix the reported database issue and run the command again.',
      }
    );
  }
}

function assertNoScreenplayAssetRelationships(session: DatabaseSession): void {
  const relationship = [
    session.db.select({ id: castAssets.id }).from(castAssets).get(),
    session.db.select({ id: locationAssets.id }).from(locationAssets).get(),
    session.db.select({ id: sequenceAssets.id }).from(sequenceAssets).get(),
    session.db.select({ id: sceneAssets.id }).from(sceneAssets).get(),
  ].find(Boolean);
  if (!relationship) {
    return;
  }
  throw new ProjectDataError(
    'PROJECT_DATA213',
    'Screenplay changes would orphan existing asset relationships.',
    {
      issues: [
        createDiagnosticError(
          'PROJECT_DATA213',
          'Screenplay changes would orphan existing asset relationships.',
          { path: ['screenplay'] },
          'Remove or move the dependent assets before replacing screenplay rows.'
        ),
      ],
      suggestion: 'Remove or move dependent assets before changing screenplay rows.',
    }
  );
}

function insertScene(
  session: DatabaseSession,
  sequence: Sequence,
  scene: Scene,
  sceneIndex: number
): void {
  session.db.insert(scenes).values({
    id: requiredId(scene),
    sequenceId: requiredId(sequence),
    title: scene.title,
    interiorExterior: scene.setting.interiorExterior ?? null,
    timeOfDay: scene.setting.timeOfDay ?? null,
    storyFunction: stringifyArray(scene.storyFunction),
    blocksJson: stringifyBlocks(scene.blocks),
    position: sceneIndex,
  }).run();
  (scene.setting.locationIds ?? []).forEach((locationId, locationIndex) => {
    session.db.insert(sceneLocations).values({
      sceneId: requiredId(scene),
      locationId,
      position: locationIndex,
    }).run();
  });
}

function deleteScreenplayTables(session: DatabaseSession): void {
  session.db.delete(sceneLocations).run();
  session.db.delete(scenes).run();
  session.db.delete(sequences).run();
  session.db.delete(acts).run();
  session.db.delete(castMembers).run();
  session.db.delete(locations).run();
  session.db.delete(screenplay).run();
}

function assignCollectionIds<T extends { id?: string; key?: string }>(
  values: T[],
  prefix: EntityIdPrefix,
  path: string[],
  kind: string,
  keys: Map<string, string>,
  generatedIds: GeneratedId[],
  allocator: (prefix: EntityIdPrefix) => string,
  issues: DiagnosticIssue[]
): void {
  values.forEach((value, index) =>
    assignObjectId(value, prefix, [...path, String(index)], kind, keys, generatedIds, allocator, issues)
  );
}

function assignObjectId<T extends { id?: string; key?: string }>(
  value: T,
  prefix: EntityIdPrefix,
  path: string[],
  kind: string,
  keys: Map<string, string>,
  generatedIds: GeneratedId[],
  allocator: (prefix: EntityIdPrefix) => string,
  issues: DiagnosticIssue[]
): void {
  if (value.key) {
    if (keys.has(value.key)) {
      issues.push(createDiagnosticError('PROJECT_DATA209', `Duplicate key: ${value.key}.`, { path: [...path, 'key'] }, 'Use a unique request-local key.'));
      return;
    }
  }
  if (!value.id) {
    value.id = allocator(prefix);
    if (value.key) {
      generatedIds.push({ kind, path: [...path, 'key'], key: value.key, id: value.id });
    }
  }
  if (value.key) {
    keys.set(value.key, value.id);
  }
  delete value.key;
}

function validateHandles(document: ScreenplayDocument, issues: DiagnosticIssue[]): void {
  const handles = new Map<string, string[]>();
  document.cast.forEach((castMember, index) =>
    validateHandle(castMember.handle, ['cast', String(index), 'handle'], handles, issues)
  );
  document.locations.forEach((location, index) =>
    validateHandle(location.handle, ['locations', String(index), 'handle'], handles, issues)
  );
}

function validateHandle(
  handle: string,
  path: string[],
  handles: Map<string, string[]>,
  issues: DiagnosticIssue[]
): void {
  if (!/^[a-z][a-z0-9-]*$/.test(handle)) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA208',
        `Invalid handle: ${handle}.`,
        { path },
        'Use lower-case slug style, starting with a letter.'
      )
    );
    return;
  }
  const firstPath = handles.get(handle);
  if (firstPath) {
    issues.push(
      createDiagnosticError(
        'PROJECT_DATA209',
        `Duplicate handle: ${handle}.`,
        { path, context: `First seen at ${firstPath.join('.')}` },
        'Use a unique handle across cast and locations.'
      )
    );
    return;
  }
  handles.set(handle, path);
}

function validateTextMentions(
  text: string,
  document: ScreenplayDocument,
  path: string[],
  issues: DiagnosticIssue[]
): void {
  const knownHandles = new Set([
    ...document.cast.map((castMember) => castMember.handle),
    ...document.locations.map((location) => location.handle),
  ]);
  for (const match of text.matchAll(/@([a-z][a-z0-9-]*)/g)) {
    const handle = match[1]!;
    if (!knownHandles.has(handle)) {
      issues.push(
        createDiagnosticError(
          'PROJECT_DATA210',
          `Unknown screenplay handle: @${handle}.`,
          { path: [...path, 'text'] },
          'Use an existing cast or location handle.'
        )
      );
    }
  }
}

function resolveRefs(
  refs: Reference[] | undefined,
  durableIds: Set<string>,
  keys: Map<string, string>,
  path: string[],
  issues: DiagnosticIssue[],
  warnings: DiagnosticIssue[]
): string[] {
  const resolved: string[] = [];
  refs?.forEach((ref, index) => {
    const id = resolveRef(ref, durableIds, keys, [...path, String(index)], issues);
    if (id) {
      addUniqueResolvedId(resolved, id, [...path, String(index)], warnings);
    }
  });
  return resolved;
}

function addUniqueResolvedId(
  resolved: string[],
  id: string,
  path: string[],
  warnings: DiagnosticIssue[]
): void {
  if (!resolved.includes(id)) {
    resolved.push(id);
    return;
  }
  warnings.push(
    createDiagnosticWarning(
      'PROJECT_DATA215',
      `Duplicate relationship reference ignored: ${id}.`,
      { path },
      'Remove duplicate relationship references.'
    )
  );
}

function resolveRef(
  ref: Reference | undefined,
  durableIds: Set<string>,
  keys: Map<string, string>,
  path: string[],
  issues: DiagnosticIssue[]
): string | undefined {
  if (!ref || (ref.id && ref.key) || (!ref.id && !ref.key)) {
    issues.push(createDiagnosticError('PROJECT_DATA211', 'Reference must provide exactly one of id or key.', { path }, 'Provide exactly one of id or key.'));
    return undefined;
  }
  const id = ref.id ?? keys.get(ref.key ?? '');
  if (!id || !durableIds.has(id)) {
    issues.push(createDiagnosticError('PROJECT_DATA210', 'Reference points to an unknown object.', { path }, 'Reference an existing object id or define the target with key in this request.'));
    return undefined;
  }
  return id;
}

function throwValidation(issues: DiagnosticIssue[]): never {
  throw new ProjectDataError('PROJECT_DATA200', 'Screenplay JSON failed validation.', {
    issues,
    suggestion: 'Fix the reported screenplay issues and run the command again.',
  });
}

function requiredId(value: { id?: string }): string {
  if (!value.id) {
    throw new ProjectDataError('PROJECT_DATA219', 'A screenplay record was missing an allocated id.');
  }
  return value.id;
}

function stringifyArray(value: unknown[] | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

function stringifyBlocks(value: Block[]): string {
  return JSON.stringify(value);
}
