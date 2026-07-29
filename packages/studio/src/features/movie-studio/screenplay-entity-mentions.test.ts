import { describe, expect, it } from 'vitest';
import {
  resolveScreenplayEntityMention,
  screenplayEntityMentionAtPosition,
  screenplayEntityMentionRanges,
  type ScreenplayEntityMentionCatalog,
} from './screenplay-entity-mentions';

const catalog: ScreenplayEntityMentionCatalog = {
  castMemberHandles: {
    urban: 'cast_urban',
    'constantine-xi-palaiologos': 'cast_constantine',
  },
  castMemberLabels: {
    cast_urban: 'Urban',
    cast_constantine: 'Constantine XI Palaiologos',
  },
  castMemberImages: {
    cast_urban: { url: '/urban-profile.jpg' },
  },
  locationHandles: {
    'imperial-council-chamber': 'location_chamber',
  },
  locationLabels: {
    location_chamber: 'Imperial Council Chamber',
  },
  locationImages: {
    location_chamber: { url: '/chamber-hero.jpg' },
  },
};

describe('screenplay entity mentions', () => {
  it('resolves exact Cast Member and Location handles case-insensitively', () => {
    expect(resolveScreenplayEntityMention('URBAN', catalog)).toEqual({
      kind: 'castMember',
      id: 'cast_urban',
      label: 'Urban',
      imageUrl: '/urban-profile.jpg',
    });
    expect(
      resolveScreenplayEntityMention('Imperial-Council-Chamber', catalog)
    ).toEqual({
      kind: 'location',
      id: 'location_chamber',
      label: 'Imperial Council Chamber',
      imageUrl: '/chamber-hero.jpg',
    });
  });

  it('returns exact ranges at boundaries, around punctuation, and across lines', () => {
    const text =
      '@urban opens; (@imperial-council-chamber), then\n@urban meets @CONSTANTINE-XI-PALAIOLOGOS';
    const ranges = screenplayEntityMentionRanges(text, catalog);

    expect(ranges.map(({ from, to, source, entity }) => ({
      from,
      to,
      source,
      substring: text.slice(from, to),
      kind: entity.kind,
      label: entity.label,
    }))).toEqual([
      {
        from: 0,
        to: 6,
        source: '@urban',
        substring: '@urban',
        kind: 'castMember',
        label: 'Urban',
      },
      {
        from: 15,
        to: 40,
        source: '@imperial-council-chamber',
        substring: '@imperial-council-chamber',
        kind: 'location',
        label: 'Imperial Council Chamber',
      },
      {
        from: 48,
        to: 54,
        source: '@urban',
        substring: '@urban',
        kind: 'castMember',
        label: 'Urban',
      },
      {
        from: 61,
        to: 88,
        source: '@CONSTANTINE-XI-PALAIOLOGOS',
        substring: '@CONSTANTINE-XI-PALAIOLOGOS',
        kind: 'castMember',
        label: 'Constantine XI Palaiologos',
      },
    ]);
  });

  it('leaves unknown, partial, embedded, and fuzzy text unresolved', () => {
    expect(
      screenplayEntityMentionRanges(
        '@unknown @urban-extra word@urban @urb an @urban',
        catalog
      ).map((range) => range.source)
    ).toEqual(['@urban']);
  });

  it('uses half-open mention boundaries for hover positions', () => {
    expect(screenplayEntityMentionAtPosition('@urban next', 5, catalog))
      .toMatchObject({ source: '@urban' });
    expect(screenplayEntityMentionAtPosition('@urban next', 6, catalog))
      .toBeNull();
  });
});
