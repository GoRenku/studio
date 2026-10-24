import { z } from 'zod';
import type { CastLooksPlanDocument, CastWardrobePlanDocument } from '@gorenku/studio-core/client';
import type { CastingWardrobeMode } from './contracts.js';
import { assertNoCastingWardrobeIssues, castingWardrobeIssue } from './diagnostics.js';

const draftText = z.string().trim().min(1);
const sceneIds = z.array(draftText);

/** Shape only: Core validates scene coverage, names and Look membership when the agent writes the plan. */
const looksPlanSchema = z.object({
  kind: z.literal('castLooksPlan'),
  castMemberId: draftText,
  looks: z.array(z.object({
    id: draftText.optional(),
    name: draftText,
    description: draftText.optional(),
    sceneIds,
  }).strict()).min(1),
}).strict();

const wardrobePlanSchema = z.object({
  kind: z.literal('castWardrobePlan'),
  castMemberId: draftText,
  costumes: z.array(z.object({
    id: draftText.optional(),
    name: draftText,
    lookId: draftText,
    wardrobe: z.array(draftText),
    continuityNotes: z.array(draftText),
    sceneIds,
  }).strict()),
}).strict();

interface DraftsByMode {
  looks: CastLooksPlanDocument;
  costumes: CastWardrobePlanDocument;
}

const DRAFT_SCHEMAS: { [M in CastingWardrobeMode]: z.ZodType<DraftsByMode[M]> } = {
  looks: looksPlanSchema,
  costumes: wardrobePlanSchema,
};

/** Checks the draft is the mode's document for this Cast Member. */
export function validateCastingWardrobeDraft<M extends CastingWardrobeMode>(
  mode: M,
  castMemberId: string,
  draft: unknown,
  path: Array<string | number>,
): DraftsByMode[M] {
  const parsed = DRAFT_SCHEMAS[mode].safeParse(draft);
  if (!parsed.success) {
    assertNoCastingWardrobeIssues(
      parsed.error.issues.map((issue) => castingWardrobeIssue([...path, ...issue.path.map((segment) => typeof segment === 'symbol' ? String(segment) : segment)], issue.message)),
      `The draft is not a valid ${mode === 'looks' ? 'castLooksPlan' : 'castWardrobePlan'} document.`,
    );
  }
  const value = parsed.data!;
  assertNoCastingWardrobeIssues(
    value.castMemberId === castMemberId ? [] : [castingWardrobeIssue([...path, 'castMemberId'], `The draft belongs to ${value.castMemberId}, not ${castMemberId}.`)],
    'The draft belongs to another Cast Member.',
  );
  return value;
}
