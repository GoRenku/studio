import { StructuredError } from '@gorenku/studio-diagnostics';

export function parseLookbookTarget(value: string, context: string): string {
  const id = parseKindedTarget(value, 'lookbook', context);
  return id;
}

export function parseCastTarget(value: string, context: string): string {
  const id = parseKindedTarget(value, 'cast', context);
  return id;
}

export function parseLocationTarget(value: string, context: string): string {
  const id = parseKindedTarget(value, 'location', context);
  return id;
}

export function parseSceneTarget(value: string, context: string): string {
  const id = parseKindedTarget(value, 'scene', context);
  return id;
}

export function parseSceneDialogueTarget(
  value: string,
  context: string
): { sceneId: string; dialogueId: string } {
  const [sceneKind, sceneId, dialogueKind, dialogueId, extra] = value.split(':');
  if (
    sceneKind !== 'scene' ||
    !sceneId ||
    dialogueKind !== 'dialogue' ||
    !dialogueId ||
    extra !== undefined
  ) {
    throw new StructuredError({
      code: 'CLI032',
      message: `${context} target must use scene:<scene-id>:dialogue:<dialogue-id>. Received: ${value}.`,
      suggestion:
        'Use --target scene:<scene-id>:dialogue:<dialogue-id>.',
    });
  }
  return { sceneId, dialogueId };
}

export function parseShots(value: string): string[] {
  const shots = value
    .split(',')
    .map((shotId) => shotId.trim())
    .filter(Boolean);
  if (shots.length === 0) {
    throw new StructuredError({
      code: 'CLI030',
      message: '--shots must include at least one shot id.',
      suggestion: 'Use --shots shot_001 or --shots shot_001,shot_002.',
    });
  }
  return shots;
}

export function parseSelection(
  value: string | undefined
): 'select' | 'take' | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'select' || value === 'take') {
    return value;
  }
  throw new StructuredError({
    code: 'CLI031',
    message: `Unsupported media import selection: ${value}.`,
    suggestion: 'Use --selection select or --selection take.',
  });
}

export function parseSections(value: string | undefined): string[] | undefined {
  return value
    ?.split(',')
    .map((section) => section.trim())
    .filter(Boolean);
}

function parseKindedTarget(
  value: string,
  expectedKind: 'lookbook' | 'cast' | 'location' | 'scene',
  context: string
): string {
  const [kind, id, extra] = value.split(':');
  if (kind !== expectedKind || !id || extra !== undefined) {
    throw new StructuredError({
      code: 'CLI025',
      message: `${context} target must use ${expectedKind}:<id>. Received: ${value}.`,
      suggestion: `Use --target ${expectedKind}:<${targetLabel(expectedKind)}>.`,
    });
  }
  return id;
}

function targetLabel(kind: 'lookbook' | 'cast' | 'location' | 'scene'): string {
  switch (kind) {
    case 'lookbook':
      return 'lookbook-id';
    case 'cast':
      return 'cast-member-id';
    case 'location':
      return 'location-id';
    case 'scene':
      return 'scene-id';
  }
}
