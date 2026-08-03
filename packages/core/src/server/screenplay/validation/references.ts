import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  DialogueTurn,
  Scene,
  ScreenplayReference,
  TextBlock,
} from '../../../client/screenplay/index.js';

export interface ScreenplaySubjectIds {
  castMemberIds: ReadonlySet<string>;
  locationIds: ReadonlySet<string>;
  propIds: ReadonlySet<string>;
}

interface TargetValue {
  key: string;
  text: string | null;
  targetKind: ScreenplayReference['target']['type'];
}

export function validateScreenplayReferences(input: {
  opening: TextBlock[];
  scenes: Scene[];
  references: ScreenplayReference[];
  subjects: ScreenplaySubjectIds;
}): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const targets = buildTargetIndex(input.opening, input.scenes);
  const referenceIds = new Set<string>();
  const speakerTurns = new Set<string>();
  const mentionRanges = new Map<string, Array<{ start: number; end: number; id: string }>>();

  input.references.forEach((reference, index) => {
    const path = ['references', String(index)];
    if (referenceIds.has(reference.id)) {
      issues.push(issue(
        'SCREENPLAY_INVALID_CONTENT',
        `Duplicate Screenplay Reference ID ${reference.id}.`,
        [...path, 'id'],
      ));
    }
    referenceIds.add(reference.id);
    validateSubject(reference, input.subjects, path, issues);
    validateRoleMatrix(reference, path, issues);

    const target = resolveTarget(reference, targets);
    if (!target) {
      issues.push(issue(
        'SCREENPLAY_REFERENCE_TARGET_NOT_FOUND',
        `Reference target ${targetKey(reference)} does not exist.`,
        [...path, 'target'],
      ));
      return;
    }

    if (reference.role === 'speaker') {
      const turnId = reference.target.type === 'dialogueCue'
        ? reference.target.turnId
        : '';
      if (speakerTurns.has(turnId)) {
        issues.push(issue(
          'SCREENPLAY_DIALOGUE_SPEAKER_CONFLICT',
          `Dialogue Turn ${turnId} has more than one speaker reference.`,
          path,
        ));
      }
      speakerTurns.add(turnId);
    }

    if (reference.role === 'mention') {
      validateMentionRange(reference, target, path, mentionRanges, issues);
    }
  });

  return issues;
}

function buildTargetIndex(
  opening: TextBlock[],
  scenes: Scene[],
): Map<string, TargetValue> {
  const targets = new Map<string, TargetValue>();
  for (const element of opening) {
    targets.set(`openingElement:${element.id}`, {
      key: `openingElement:${element.id}`,
      text: element.text,
      targetKind: 'openingElement',
    });
  }
  for (const scene of scenes) {
    targets.set(`scene:${scene.id}`, {
      key: `scene:${scene.id}`,
      text: null,
      targetKind: 'scene',
    });
    targets.set(`sceneHeading:${scene.id}`, {
      key: `sceneHeading:${scene.id}`,
      text: scene.heading,
      targetKind: 'sceneHeading',
    });
    for (const block of scene.blocks) {
      targets.set(`block:${scene.id}:${block.id}`, {
        key: `block:${scene.id}:${block.id}`,
        text: block.type === 'dialogue' || block.type === 'dualDialogue'
          ? null
          : block.text,
        targetKind: 'block',
      });
      if (block.type === 'dialogue') {
        addTurnTargets(targets, scene.id, block);
      } else if (block.type === 'dualDialogue') {
        addTurnTargets(targets, scene.id, block.left);
        addTurnTargets(targets, scene.id, block.right);
      }
    }
  }
  return targets;
}

function addTurnTargets(
  targets: Map<string, TargetValue>,
  sceneId: string,
  turn: DialogueTurn,
): void {
  targets.set(`dialogueCue:${sceneId}:${turn.id}`, {
    key: `dialogueCue:${sceneId}:${turn.id}`,
    text: turn.characterName,
    targetKind: 'dialogueCue',
  });
  for (const part of turn.parts) {
    targets.set(`dialoguePart:${sceneId}:${turn.id}:${part.id}`, {
      key: `dialoguePart:${sceneId}:${turn.id}:${part.id}`,
      text: part.text,
      targetKind: 'dialoguePart',
    });
  }
}

function validateSubject(
  reference: ScreenplayReference,
  subjects: ScreenplaySubjectIds,
  path: string[],
  issues: DiagnosticIssue[],
): void {
  const exists = reference.subject.type === 'castMember'
    ? subjects.castMemberIds.has(reference.subject.id)
    : reference.subject.type === 'location'
      ? subjects.locationIds.has(reference.subject.id)
      : subjects.propIds.has(reference.subject.id);
  if (!exists) {
    issues.push(issue(
      'SCREENPLAY_REFERENCE_SUBJECT_NOT_FOUND',
      `${reference.subject.type} ${reference.subject.id} does not exist.`,
      [...path, 'subject'],
    ));
  }
}

function validateRoleMatrix(
  reference: ScreenplayReference,
  path: string[],
  issues: DiagnosticIssue[],
): void {
  const subject = reference.subject.type;
  const target = reference.target.type;
  const valid = reference.role === 'speaker'
    ? subject === 'castMember' && target === 'dialogueCue' && !reference.range
    : reference.role === 'setting'
      ? subject === 'location' && (target === 'scene' || target === 'sceneHeading') && !reference.range
      : reference.role === 'mention'
        ? target !== 'scene' && Boolean(reference.range)
        : (target === 'scene' || target === 'block') && !reference.range;
  if (!valid) {
    issues.push(issue(
      'SCREENPLAY_REFERENCE_RANGE_INVALID',
      `Role ${reference.role} is not valid for ${subject} -> ${target}.`,
      path,
    ));
  }
}

function validateMentionRange(
  reference: ScreenplayReference,
  target: TargetValue,
  path: string[],
  ranges: Map<string, Array<{ start: number; end: number; id: string }>>,
  issues: DiagnosticIssue[],
): void {
  const range = reference.range;
  if (!range || target.text === null) {
    issues.push(issue(
      'SCREENPLAY_REFERENCE_RANGE_INVALID',
      'Mention references require a textual target and non-empty range.',
      [...path, 'range'],
    ));
    return;
  }
  const end = range.start + range.length;
  if (
    range.start < 0 ||
    range.length <= 0 ||
    end > target.text.length ||
    splitsSurrogate(target.text, range.start) ||
    splitsSurrogate(target.text, end)
  ) {
    issues.push(issue(
      'SCREENPLAY_REFERENCE_RANGE_INVALID',
      `Reference range ${range.start}:${range.length} is invalid for ${target.key}.`,
      [...path, 'range'],
    ));
    return;
  }
  const targetRanges = ranges.get(target.key) ?? [];
  if (targetRanges.some((candidate) => range.start < candidate.end && end > candidate.start)) {
    issues.push(issue(
      'SCREENPLAY_REFERENCE_RANGE_OVERLAP',
      `Reference ${reference.id} overlaps another mention on ${target.key}.`,
      [...path, 'range'],
    ));
  }
  targetRanges.push({ start: range.start, end, id: reference.id });
  ranges.set(target.key, targetRanges);
}

function resolveTarget(
  reference: ScreenplayReference,
  targets: Map<string, TargetValue>,
): TargetValue | undefined {
  return targets.get(targetKey(reference));
}

function targetKey(reference: ScreenplayReference): string {
  const target = reference.target;
  switch (target.type) {
    case 'openingElement': return `openingElement:${target.elementId}`;
    case 'scene': return `scene:${target.sceneId}`;
    case 'sceneHeading': return `sceneHeading:${target.sceneId}`;
    case 'block': return `block:${target.sceneId}:${target.blockId}`;
    case 'dialogueCue': return `dialogueCue:${target.sceneId}:${target.turnId}`;
    case 'dialoguePart': return `dialoguePart:${target.sceneId}:${target.turnId}:${target.partId}`;
  }
}

function splitsSurrogate(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) {
    return false;
  }
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

function issue(code: string, message: string, path: string[]): DiagnosticIssue {
  return createDiagnosticError(
    code,
    message,
    { path, context: 'screenplay references' },
    'Use an existing Project subject and exact Screenplay target with a valid role and range.',
  );
}
