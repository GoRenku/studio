import { z } from 'zod';
import { castingRouteSchema, IMAGE_DETAIL_LEVELS } from '@gorenku/studio-core/client';

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

/** Purpose-level bound on how many costumes one character sheet round panel covers. */
const CASTING_ROUND_MAX_COSTUMES = 20;

export const castingRoundOpenSchema = z.object({
  project: castingIdentity,
  subject: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('look'), lookId: castingIdentity }).strict()
      .describe('A casting round of candidates for one Look.'),
    z.object({ kind: z.literal('costumes'), costumeIds: z.array(castingIdentity).min(1).max(CASTING_ROUND_MAX_COSTUMES) }).strict()
      .describe('Character sheet rounds for costumes of one cast Look; each costume gets its own round.'),
  ]),
  brief: z.array(z.string().trim().min(1).max(CASTING_ROUND_MAX_LINE)).min(1).max(CASTING_ROUND_MAX_BRIEF_LINES)
    .describe('What each candidate or sheet shows, as short display lines. Shown as written; never stored.'),
  notes: z.record(castingIdentity, z.string().trim().min(1).max(200)).optional()
    .describe('One-line strength notes from the Skill, keyed by Default Model List image-lane model key.'),
  references: z.array(castingIdentity).max(20).optional()
    .describe('Identity reference Asset File ids of this Cast Member, such as an earlier Look\'s cast candidate, the candidates the director kept, or a costume\'s kept sheets. Costumes default to the Look\'s cast candidate.'),
  suggested: z.array(castingRouteInputSchema).optional()
    .describe('Preselect these models and counts (per round) instead of the saved defaults.'),
}).strict();

export const castingRoundRespondSchema = z.object({
  panelId: castingIdentity,
  choice: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('generate'),
      routes: z.array(castingRouteInputSchema).min(1),
      maxConcurrentGenerations: z.number().int().min(1),
      detail: z.enum(IMAGE_DETAIL_LEVELS),
      costumeIds: z.array(castingIdentity).min(1).optional(),
    }).strict(),
    z.object({ kind: z.literal('canceled') }).strict(),
  ]),
  saveAsDefaults: z.boolean(),
}).strict();

export const castingRoundConsumeSchema = z.object({ panelId: castingIdentity }).strict();
