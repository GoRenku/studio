import { z } from 'zod';
import { GENERATION_LANES } from '@gorenku/studio-core/client';
import { nativeRequestControlsSchema } from './native-request-controls/schemas.js';

const identity = z.string().min(1).max(512);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const route = z.object({
  provider: identity, providerLabel: identity, model: identity, label: identity,
  mediaKind: z.enum(['image', 'video', 'audio']),
}).strict();

const issue = z.object({
  code: identity, message: z.string(), severity: z.enum(['error', 'warning']),
  location: z.object({ filePath: z.string().optional(), path: z.array(z.string()), context: z.string().optional() }).strict(),
  suggestion: z.string().optional(),
}).strict();

export const generationReviewInputSchema = z.object({
  project: identity,
  lane: z.enum(GENERATION_LANES).optional().describe('The generation lane from generation context workflowPolicy; required when opening a new review.'),
  reviewId: identity.optional(), expectedRevision: z.number().int().positive().optional(),
  requests: z.array(z.object({
    reviewFile: identity.describe('Project-relative review file. Prepare replacements in a separate file; only the selected request may adopt a new file after validation. Keep all currently bound files unchanged.'), expectedRequestSha256: sha256.optional(),
    routes: z.array(route).min(1), controls: nativeRequestControlsSchema,
  }).strict()).min(1).optional(),
  preparationFailure: z.array(issue).min(1).optional(),
}).strict();

export type GenerationReviewInput = z.infer<typeof generationReviewInputSchema>;

export const generationReviewResponseSchema = z.object({
  reviewId: identity, expectedRevision: z.number().int().positive(), responseId: identity,
  action: z.enum(['reconfigure', 'submit', 'cancel']),
  drafts: z.array(z.object({ requestId: identity, prompt: z.string().nullable(), values: z.record(z.string(), z.json()) }).strict()),
  selectedRoute: z.object({ requestId: identity, route }).strict().optional(),
  askBeforeGeneratingNextTime: z.boolean().optional(),
}).strict();

export const generationReviewEstimateSchema = z.object({
  reviewId: identity, requestId: identity,
  values: z.record(z.string(), z.json()),
}).strict();

export const generationReviewConsumeSchema = z.object({ reviewId: identity, responseId: identity }).strict();
