/**
 * Profile descriptions are stored as fixed, named sections. Studio owns the
 * section keys and their display order; the text inside each section is
 * authored domain text that Studio shows exactly as written.
 */
export const CAST_MEMBER_DESCRIPTION_SECTION_KEYS = [
  'overview',
  'appearance',
  'behavior',
  'wardrobe',
  'performance',
  'sourceNotes',
] as const;

export const LOCATION_DESCRIPTION_SECTION_KEYS = [
  'overview',
  'storyUse',
  'spaceAndLayout',
  'statesAndChanges',
  'sourceNotes',
] as const;

export const PROP_DESCRIPTION_SECTION_KEYS = [
  'overview',
  'storyUse',
  'formAndMaterials',
  'statesAndContinuity',
  'sourceNotes',
] as const;

export type CastMemberDescriptionSectionKey =
  (typeof CAST_MEMBER_DESCRIPTION_SECTION_KEYS)[number];
export type LocationDescriptionSectionKey =
  (typeof LOCATION_DESCRIPTION_SECTION_KEYS)[number];
export type PropDescriptionSectionKey = (typeof PROP_DESCRIPTION_SECTION_KEYS)[number];

/** Section text is plain text; blank lines separate paragraphs. */
export type CastMemberDescription = Partial<Record<CastMemberDescriptionSectionKey, string>>;
export type LocationDescription = Partial<Record<LocationDescriptionSectionKey, string>>;
export type PropDescription = Partial<Record<PropDescriptionSectionKey, string>>;
