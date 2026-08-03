import type {
  AuthoringIdentity,
  DialogueBlockInput,
  DialoguePartInput,
  DialogueTurnInput,
  GeneratedScreenplayIdentity,
  GeneratedScreenplayIdentityKind,
  Scene,
  SceneInput,
  Screenplay,
  ScreenplayBlock,
  ScreenplayBlockInput,
  ScreenplayInput,
  ScreenplayMutationReport,
  ScreenplayReference,
  ScreenplayReferenceInput,
  ScreenplayReferenceTarget,
  ScreenplaySection,
  ScreenplaySectionInput,
  ScreenplayStructureEntry,
  ScreenplayStructureEntryInput,
  TextBlock,
  TextBlockInput,
} from '../../../client/screenplay/index.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type EntityIdPrefix,
  type ProjectIdGenerator,
} from '../../entity-ids.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { readProjectRecord } from '../../database/access/project.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { studioScreenplayResourceKey } from '../../studio-coordination/resource-keys.js';
import { assertDialogueAudioSpeakerBindings } from '../../scene-dialogue-audio-workspace/turns.js';
import { readScreenplayAggregate, replaceScreenplayAggregate } from '../persistence/screenplay.js';
import { insertScreenplayRevision } from '../persistence/revisions.js';
import { assertValidScreenplayInput } from '../validation/blocks.js';

export async function createScreenplay(
  input: RenkuConfigPathOptions & {
    projectName: string;
    screenplay: ScreenplayInput;
    idGenerator?: ProjectIdGenerator;
  },
): Promise<ScreenplayMutationReport> {
  assertValidScreenplayInput(input.screenplay);
  const { session } = await openProjectSession(input);
  try {
    const current = readScreenplayAggregate(session);
    if (!isEmptyScreenplay(current)) {
      throw new ProjectDataError(
        'SCREENPLAY_NOT_EMPTY',
        'Screenplay creation requires an empty Screenplay.',
        { suggestion: 'Use screenplay operations to revise the existing Screenplay.' },
      );
    }
    const resolver = new ScreenplayIdentityResolver(
      input.idGenerator ?? createRandomIdGenerator(),
    );
    preallocateScreenplayInput(resolver, input.screenplay);
    const resolved = resolveScreenplayInput(resolver, input.screenplay);
    return commitScreenplayMutation({
      session,
      screenplay: resolved,
      resolver,
      sourceCommand: 'screenplay.create',
    });
  } finally {
    session.close();
  }
}

export class ScreenplayIdentityResolver {
  readonly generatedIdentities: GeneratedScreenplayIdentity[] = [];
  private readonly generator: ProjectIdGenerator;
  private readonly knownIds = new Map<string, Set<GeneratedScreenplayIdentityKind>>();
  private readonly keys = new Map<string, GeneratedScreenplayIdentity>();

  constructor(generator: ProjectIdGenerator, screenplay?: Screenplay) {
    this.generator = generator;
    if (screenplay) {
      this.seedScreenplay(screenplay);
    }
  }

  allocate(
    identity: AuthoringIdentity<string>,
    kind: GeneratedScreenplayIdentityKind,
    prefix: EntityIdPrefix,
    requireKey: boolean,
  ): string {
    if ('id' in identity && identity.id !== undefined) {
      if (requireKey) {
        throw invalidIdentity('New Screenplay values must use request-local keys.');
      }
      if (!this.knownIds.get(identity.id)?.has(kind)) {
        throw invalidIdentity(
          `Screenplay ${kind} ID ${identity.id} does not identify an existing ${kind}.`,
        );
      }
      return identity.id;
    }
    const key = identity.key;
    if (!key) {
      throw invalidIdentity('Screenplay authoring identity is missing an ID or key.');
    }
    const existing = this.keys.get(key);
    if (existing) {
      if (existing.kind !== kind) {
        throw invalidIdentity(`Authoring key ${key} is already used as ${existing.kind}.`);
      }
      return existing.id;
    }
    const generated = { kind, key, id: this.allocateUniqueId(prefix) };
    this.keys.set(key, generated);
    this.remember(generated.id, kind);
    this.generatedIdentities.push(generated);
    return generated.id;
  }

  reference(identity: AuthoringIdentity<string>): string {
    if ('id' in identity && identity.id !== undefined) {
      if (!this.knownIds.has(identity.id)) {
        throw invalidIdentity(`Screenplay ID ${identity.id} does not exist.`);
      }
      return identity.id;
    }
    const key = identity.key;
    const generated = key ? this.keys.get(key) : undefined;
    if (!generated) {
      throw invalidIdentity(`Authoring key ${key ?? ''} has not been created in this request.`);
    }
    return generated.id;
  }

  private allocateUniqueId(prefix: EntityIdPrefix): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const id = this.generator.next(prefix);
      if (!this.knownIds.has(id)) {
        return id;
      }
    }
    throw invalidIdentity(`Unable to allocate a unique ${prefix} ID.`);
  }

  private remember(id: string, kind: GeneratedScreenplayIdentityKind): void {
    const kinds = this.knownIds.get(id) ?? new Set<GeneratedScreenplayIdentityKind>();
    kinds.add(kind);
    this.knownIds.set(id, kinds);
  }

  private seedScreenplay(screenplay: Screenplay): void {
    screenplay.opening.forEach((block) => this.remember(block.id, 'block'));
    screenplay.scenes.forEach((scene) => {
      this.remember(scene.id, 'scene');
      scene.blocks.forEach((block) => {
        if (block.type === 'dialogue') {
          this.remember(block.id, 'dialogueBlock');
          block.parts.forEach((part) => this.remember(part.id, 'dialoguePart'));
          return;
        }
        this.remember(block.id, 'block');
        if (block.type === 'dualDialogue') {
          for (const turn of [block.left, block.right]) {
            this.remember(turn.id, 'dialogueTurn');
            turn.parts.forEach((part) => this.remember(part.id, 'dialoguePart'));
          }
        }
      });
    });
    screenplay.sections.forEach((section) => this.remember(section.id, 'section'));
    screenplay.structure.forEach((entry) => this.remember(entry.id, 'structureEntry'));
    screenplay.references.forEach((reference) => this.remember(reference.id, 'reference'));
  }
}

export function preallocateScreenplayInput(
  resolver: ScreenplayIdentityResolver,
  input: ScreenplayInput,
): void {
  input.opening.forEach((block) => preallocateBlock(resolver, block, true));
  input.scenes.forEach((scene) => {
    resolver.allocate(scene, 'scene', 'scene', true);
    scene.blocks.forEach((block) => preallocateBlock(resolver, block, true));
  });
  input.sections.forEach((section) => {
    resolver.allocate(section, 'section', 'screenplay_section', true);
  });
  input.structure.forEach((entry) => {
    resolver.allocate(entry, 'structureEntry', 'screenplay_structure_entry', true);
  });
  input.references.forEach((reference) => {
    resolver.allocate(reference, 'reference', 'screenplay_reference', true);
  });
}

export function preallocateSceneInput(
  resolver: ScreenplayIdentityResolver,
  scene: SceneInput,
  requireSceneKey: boolean,
  requireNestedKeys = false,
): void {
  resolver.allocate(scene, 'scene', 'scene', requireSceneKey);
  scene.blocks.forEach((block) => preallocateBlock(resolver, block, requireNestedKeys));
}

export function preallocateOpeningInput(
  resolver: ScreenplayIdentityResolver,
  opening: TextBlockInput[],
): void {
  opening.forEach((block) => preallocateBlock(resolver, block, false));
}

export function preallocateSectionInput(
  resolver: ScreenplayIdentityResolver,
  section: ScreenplaySectionInput,
  requireKey: boolean,
): void {
  resolver.allocate(section, 'section', 'screenplay_section', requireKey);
}

export function preallocateReferenceInput(
  resolver: ScreenplayIdentityResolver,
  reference: ScreenplayReferenceInput,
  requireKey: boolean,
): void {
  resolver.allocate(reference, 'reference', 'screenplay_reference', requireKey);
}

export function resolveSceneInput(
  resolver: ScreenplayIdentityResolver,
  input: SceneInput,
): Scene {
  return {
    id: resolver.reference(input),
    ...(input.productionNumber ? { productionNumber: input.productionNumber } : {}),
    heading: input.heading,
    ...(input.title ? { title: input.title } : {}),
    blocks: input.blocks.map((block) => resolveBlock(resolver, block)),
  };
}

export function resolveSectionInput(
  resolver: ScreenplayIdentityResolver,
  input: ScreenplaySectionInput,
): ScreenplaySection {
  return {
    id: resolver.reference(input),
    type: input.type,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
  };
}

export function resolveReferenceInput(
  resolver: ScreenplayIdentityResolver,
  input: ScreenplayReferenceInput,
): ScreenplayReference {
  return {
    id: resolver.reference(input),
    subject: input.subject,
    target: resolveReferenceTarget(resolver, input.target),
    role: input.role,
    ...(input.range ? { range: input.range } : {}),
  };
}

export function resolveOpeningInput(
  resolver: ScreenplayIdentityResolver,
  input: TextBlockInput[],
): TextBlock[] {
  return input.map((block) => resolveTextBlock(resolver, block));
}

export function commitScreenplayMutation(input: {
  session: Parameters<typeof readProjectRecord>[0];
  screenplay: Screenplay;
  resolver: ScreenplayIdentityResolver;
  sourceCommand: string;
  summary?: string;
  resourceKeys?: string[];
}): ScreenplayMutationReport {
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${input.session.databasePath}.`,
    );
  }
  const revisionId = createUniqueIdAllocator(createRandomIdGenerator())('screenplay_revision');
  const createdAt = new Date().toISOString();
  input.session.db.transaction((tx) => {
    const txSession = { ...input.session, db: tx };
    assertDialogueAudioSpeakerBindings(txSession, input.screenplay);
    replaceScreenplayAggregate(txSession, input.screenplay);
    insertScreenplayRevision({
      session: txSession,
      id: revisionId,
      screenplay: input.screenplay,
      sourceCommand: input.sourceCommand,
      summary: input.summary,
      createdAt,
    });
  });
  return {
    valid: true,
    warnings: [],
    project: { id: project.id, projectName: project.projectName },
    screenplayRevisionId: revisionId,
    generatedIdentities: input.resolver.generatedIdentities,
    resourceKeys: input.resourceKeys ?? [studioScreenplayResourceKey()],
  };
}

function resolveScreenplayInput(
  resolver: ScreenplayIdentityResolver,
  input: ScreenplayInput,
): Screenplay {
  return {
    opening: resolveOpeningInput(resolver, input.opening),
    scenes: input.scenes.map((scene) => resolveSceneInput(resolver, scene)),
    sections: input.sections.map((section) => resolveSectionInput(resolver, section)),
    structure: input.structure.map((entry) => resolveStructureEntry(resolver, entry)),
    references: input.references.map((reference) => resolveReferenceInput(resolver, reference)),
  };
}

function resolveStructureEntry(
  resolver: ScreenplayIdentityResolver,
  input: ScreenplayStructureEntryInput,
): ScreenplayStructureEntry {
  return {
    id: resolver.reference(input),
    ...(input.parentSection
      ? { parentSectionId: resolver.reference(input.parentSection) }
      : {}),
    content: input.content.type === 'scene'
      ? { type: 'scene', sceneId: resolver.reference(input.content.scene) }
      : { type: 'section', sectionId: resolver.reference(input.content.section) },
    position: input.position,
  };
}

function preallocateBlock(
  resolver: ScreenplayIdentityResolver,
  input: ScreenplayBlockInput,
  requireKey: boolean,
): void {
  if (input.type === 'dialogue') {
    resolver.allocate(input, 'dialogueBlock', 'screenplay_block', requireKey);
    input.parts.forEach((part) => {
      resolver.allocate(part, 'dialoguePart', 'screenplay_dialogue_part', requireKey);
    });
    return;
  }
  resolver.allocate(input, 'block', 'screenplay_block', requireKey);
  if (input.type === 'dualDialogue') {
    for (const turn of [input.left, input.right]) {
      resolver.allocate(turn, 'dialogueTurn', 'scene_dialogue', requireKey);
      turn.parts.forEach((part) => {
        resolver.allocate(part, 'dialoguePart', 'screenplay_dialogue_part', requireKey);
      });
    }
  }
}

function resolveBlock(
  resolver: ScreenplayIdentityResolver,
  input: ScreenplayBlockInput,
): ScreenplayBlock {
  if (input.type === 'dialogue') {
    return resolveDialogueBlock(resolver, input);
  }
  if (input.type === 'dualDialogue') {
    return {
      id: resolver.reference(input),
      type: 'dualDialogue',
      left: resolveDialogueTurn(resolver, input.left),
      right: resolveDialogueTurn(resolver, input.right),
    };
  }
  return resolveTextBlock(resolver, input);
}

function resolveTextBlock(
  resolver: ScreenplayIdentityResolver,
  input: TextBlockInput,
): TextBlock {
  return { id: resolver.reference(input), type: input.type, text: input.text };
}

function resolveDialogueBlock(
  resolver: ScreenplayIdentityResolver,
  input: DialogueBlockInput,
): ScreenplayBlock {
  return {
    id: resolver.reference(input),
    type: 'dialogue',
    characterName: input.characterName,
    extensions: input.extensions,
    parts: input.parts.map((part) => resolveDialoguePart(resolver, part)),
  };
}

function resolveDialogueTurn(
  resolver: ScreenplayIdentityResolver,
  input: DialogueTurnInput,
) {
  return {
    id: resolver.reference(input),
    characterName: input.characterName,
    extensions: input.extensions,
    parts: input.parts.map((part) => resolveDialoguePart(resolver, part)),
  };
}

function resolveDialoguePart(
  resolver: ScreenplayIdentityResolver,
  input: DialoguePartInput,
) {
  return { id: resolver.reference(input), type: input.type, text: input.text };
}

function resolveReferenceTarget(
  resolver: ScreenplayIdentityResolver,
  input: ScreenplayReferenceInput['target'],
): ScreenplayReferenceTarget {
  switch (input.type) {
    case 'openingElement': return { type: 'openingElement', elementId: resolver.reference(input.element) };
    case 'scene': return { type: 'scene', sceneId: resolver.reference(input.scene) };
    case 'sceneHeading': return { type: 'sceneHeading', sceneId: resolver.reference(input.scene) };
    case 'block': return {
      type: 'block',
      sceneId: resolver.reference(input.scene),
      blockId: resolver.reference(input.block),
    };
    case 'dialogueCue': return {
      type: 'dialogueCue',
      sceneId: resolver.reference(input.scene),
      turnId: resolver.reference(input.turn),
    };
    case 'dialoguePart': return {
      type: 'dialoguePart',
      sceneId: resolver.reference(input.scene),
      turnId: resolver.reference(input.turn),
      partId: resolver.reference(input.part),
    };
  }
}

function isEmptyScreenplay(screenplay: Screenplay): boolean {
  return screenplay.opening.length === 0
    && screenplay.scenes.length === 0
    && screenplay.sections.length === 0
    && screenplay.structure.length === 0
    && screenplay.references.length === 0;
}

function invalidIdentity(message: string): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_INVALID_CONTENT',
    message,
    { suggestion: 'Use exactly one durable ID or unique request-local key.' },
  );
}
