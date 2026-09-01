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

export function parsePropTarget(value: string, context: string): string {
  return parseKindedTarget(value, 'prop', context);
}

export function parseSceneTarget(value: string, context: string): string {
  const id = parseKindedTarget(value, 'scene', context);
  return id;
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
  expectedKind: 'lookbook' | 'cast' | 'location' | 'prop' | 'scene',
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

function targetLabel(kind: 'lookbook' | 'cast' | 'location' | 'prop' | 'scene'): string {
  switch (kind) {
    case 'lookbook':
      return 'lookbook-id';
    case 'cast':
      return 'cast-member-id';
    case 'location':
      return 'location-id';
    case 'prop':
      return 'prop-id';
    case 'scene':
      return 'scene-id';
  }
}
