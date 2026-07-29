export interface ScreenplayEntityMentionCatalog {
  castMemberHandles: Record<string, string>;
  castMemberLabels: Record<string, string>;
  castMemberImages: Record<string, { url: string }>;
  locationHandles: Record<string, string>;
  locationLabels: Record<string, string>;
  locationImages: Record<string, { url: string }>;
}

export interface ScreenplayEntityMention {
  kind: 'castMember' | 'location';
  id: string;
  label: string;
  imageUrl: string | null;
}

export interface ScreenplayEntityMentionRange {
  from: number;
  to: number;
  source: string;
  entity: ScreenplayEntityMention;
}

const SCREENPLAY_HANDLE_PATTERN = /@([A-Za-z0-9][A-Za-z0-9_-]*)/g;
const SCREENPLAY_HANDLE_CHARACTER_PATTERN = /[A-Za-z0-9_-]/;

export function resolveScreenplayEntityMention(
  handle: string,
  catalog: ScreenplayEntityMentionCatalog
): ScreenplayEntityMention | null {
  const canonicalHandle = handle.toLowerCase();
  const castMemberId = catalog.castMemberHandles[canonicalHandle];
  if (castMemberId) {
    return {
      kind: 'castMember',
      id: castMemberId,
      label: catalog.castMemberLabels[castMemberId] ?? canonicalHandle,
      imageUrl: catalog.castMemberImages[castMemberId]?.url ?? null,
    };
  }
  const locationId = catalog.locationHandles[canonicalHandle];
  if (locationId) {
    return {
      kind: 'location',
      id: locationId,
      label: catalog.locationLabels[locationId] ?? canonicalHandle,
      imageUrl: catalog.locationImages[locationId]?.url ?? null,
    };
  }
  return null;
}

export function screenplayEntityMentionRanges(
  text: string,
  catalog: ScreenplayEntityMentionCatalog
): ScreenplayEntityMentionRange[] {
  const ranges: ScreenplayEntityMentionRange[] = [];
  SCREENPLAY_HANDLE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SCREENPLAY_HANDLE_PATTERN.exec(text)) !== null) {
    const from = match.index;
    if (
      from > 0 &&
      SCREENPLAY_HANDLE_CHARACTER_PATTERN.test(text[from - 1] ?? '')
    ) {
      continue;
    }
    const entity = resolveScreenplayEntityMention(match[1], catalog);
    if (!entity) {
      continue;
    }
    ranges.push({
      from,
      to: from + match[0].length,
      source: match[0],
      entity,
    });
  }
  return ranges;
}

export function screenplayEntityMentionAtPosition(
  text: string,
  position: number,
  catalog: ScreenplayEntityMentionCatalog
): ScreenplayEntityMentionRange | null {
  return screenplayEntityMentionRanges(text, catalog).find(
    (range) => position >= range.from && position < range.to
  ) ?? null;
}
