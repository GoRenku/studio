import type {
  CastMemberDescriptionSectionKey,
  LocationDescriptionSectionKey,
  PropDescriptionSectionKey,
} from '@gorenku/studio-core/client';

/**
 * Headed description sections in display order. `overview` (shown first,
 * without a heading) and `sourceNotes` (shown as a footnote) are rendered by
 * key, so they are not listed here.
 */
export interface ProfileDescriptionHeading<Key extends string> {
  key: Exclude<Key, 'overview' | 'sourceNotes'>;
  heading: string;
}

export const CAST_MEMBER_DESCRIPTION_HEADINGS: ProfileDescriptionHeading<CastMemberDescriptionSectionKey>[] = [
  { key: 'appearance', heading: 'Identity and appearance' },
  { key: 'behavior', heading: 'Behavior and relationships' },
  { key: 'wardrobe', heading: 'Clothing and physical continuity' },
  { key: 'performance', heading: 'Performance and story continuity' },
];

export const LOCATION_DESCRIPTION_HEADINGS: ProfileDescriptionHeading<LocationDescriptionSectionKey>[] = [
  { key: 'storyUse', heading: 'In the story' },
  { key: 'spaceAndLayout', heading: 'Space and layout' },
  { key: 'statesAndChanges', heading: 'States and changes' },
];

export const PROP_DESCRIPTION_HEADINGS: ProfileDescriptionHeading<PropDescriptionSectionKey>[] = [
  { key: 'storyUse', heading: 'In the story' },
  { key: 'formAndMaterials', heading: 'Form and materials' },
  { key: 'statesAndContinuity', heading: 'States and continuity' },
];
