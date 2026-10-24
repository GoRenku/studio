import { z } from 'zod';
import { castingRouteSchema } from '@gorenku/studio-core/client';

const castingIdentity = z.string().min(1).max(512);

/** Core's per-route count bound for a Casting Round. */
export const CASTING_ROUND_MAX_COUNT_PER_MODEL = castingRouteSchema.properties.count.maximum;

/** Purpose-level envelope bounds of the opening input; not model facts. */
const CASTING_ROUND_MAX_BRIEF_LINES = 20;
const CASTING_ROUND_MAX_LINE = 500;

const castingRouteInputSchema = z.object({
  provider: castingIdentity,
  model: z.object({
    key: castingIdentity.describe('A model key from the Default Model List image lane.'),
    name: z.string().trim().min(1).max(200),
  }).strict(),
  count: z.number().int().min(1).max(CASTING_ROUND_MAX_COUNT_PER_MODEL),
}).strict();

export const castingRoundOpenSchema = z.object({
  project: castingIdentity,
  lookId: castingIdentity,
  brief: z.array(z.string().trim().min(1).max(CASTING_ROUND_MAX_LINE)).min(1).max(CASTING_ROUND_MAX_BRIEF_LINES)
    .describe('What each candidate shows, as short display lines. Shown as written; never stored.'),
  notes: z.record(castingIdentity, z.string().trim().min(1).max(200)).optional()
    .describe('One-line strength notes from the Skill, keyed by Default Model List image-lane model key.'),
  references: z.array(castingIdentity).max(20).optional()
    .describe('Identity reference Asset File ids of this Cast Member, such as an earlier Look\'s cast candidate or shortlisted candidates.'),
  suggested: z.array(castingRouteInputSchema).optional()
    .describe('Preselect these models and counts instead of the casting defaults.'),
}).strict();

export const castingRoundRespondSchema = z.object({
  panelId: castingIdentity,
  choice: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('generate'),
      routes: z.array(castingRouteInputSchema).min(1),
      maxConcurrentGenerations: z.number().int().min(1),
    }).strict(),
    z.object({ kind: z.literal('canceled') }).strict(),
  ]),
  saveAsCastingDefaults: z.boolean(),
}).strict();

export const castingRoundConsumeSchema = z.object({ panelId: castingIdentity }).strict();
