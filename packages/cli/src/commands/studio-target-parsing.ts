import type { AssetTarget } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';

type AssetTargetCliKind = 'cast' | 'location' | 'sequence' | 'scene';

const ASSET_TARGET_BUILDERS: Record<
  AssetTargetCliKind,
  (id: string) => AssetTarget
> = {
  cast: (id) => ({ kind: 'castMember', castMemberId: id }),
  location: (id) => ({ kind: 'location', locationId: id }),
  sequence: (id) => ({ kind: 'sequence', sequenceId: id }),
  scene: (id) => ({ kind: 'scene', sceneId: id }),
};

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

export function parseAssetTarget(value: string, context: string): AssetTarget {
  if (value === 'project') {
    return { kind: 'project' };
  }
  const [kind, id, extra] = value.split(':');
  if (extra !== undefined || !id || !isAssetTargetCliKind(kind)) {
    throw invalidAssetTarget(value, context);
  }
  return ASSET_TARGET_BUILDERS[kind](id);
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

export function parseAnchor(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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

function isAssetTargetCliKind(kind: string): kind is AssetTargetCliKind {
  return kind in ASSET_TARGET_BUILDERS;
}

function invalidAssetTarget(value: string, context: string): StructuredError {
  return new StructuredError({
    code: 'CLI025',
    message: `${context} target must use project, cast:<cast-member-id>, location:<location-id>, sequence:<sequence-id>, or scene:<scene-id>. Received: ${value}.`,
    suggestion:
      'Use --target project, --target cast:<cast-member-id>, --target location:<location-id>, --target sequence:<sequence-id>, or --target scene:<scene-id>.',
  });
}
