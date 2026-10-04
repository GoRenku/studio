import { z } from 'zod';
import type { GenerationReviewField } from './client.js';

const identity = z.string().min(1).max(512);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const route = z.object({
  provider: identity, providerLabel: identity, model: identity, label: identity,
  mediaKind: z.enum(['image', 'video', 'audio']),
}).strict();

const field: z.ZodType<GenerationReviewField> = z.lazy(() => z.object({
  key: identity, label: identity, description: z.string().optional(),
  kind: z.enum(['text', 'multiline', 'number', 'integer', 'boolean', 'enum', 'multi-enum', 'object', 'array']),
  initialValue: z.json().optional(), required: z.boolean().optional(), nullable: z.boolean().optional(),
  minimum: z.number().finite().optional(), maximum: z.number().finite().optional(), step: z.number().positive().optional(),
  options: z.array(z.object({ value: z.json(), label: identity, description: z.string().optional() }).strict()).optional(),
  properties: z.array(field).optional(), element: field.optional(),
}).strict());

const controls = z.object({
  groups: z.array(z.object({ label: identity, fields: z.array(field) }).strict()),
}).strict();

const issue = z.object({
  code: identity, message: z.string(), severity: z.enum(['error', 'warning']),
  location: z.object({ filePath: z.string().optional(), path: z.array(z.string()), context: z.string().optional() }).strict(),
  suggestion: z.string().optional(),
}).strict();

export const generationReviewInputSchema = z.object({
  project: identity,
  reviewId: identity.optional(), expectedRevision: z.number().int().positive().optional(),
  requests: z.array(z.object({
    reviewFile: identity.describe('Project-relative review file. Prepare replacements in a separate file; only the selected request may adopt a new file after validation. Keep all currently bound files unchanged.'), expectedRequestSha256: sha256.optional(),
    routes: z.array(route).min(1), controls,
  }).strict()).min(1).optional(),
  preparationFailure: z.array(issue).min(1).optional(),
}).strict();

export type GenerationReviewInput = z.infer<typeof generationReviewInputSchema>;

export const generationReviewResponseSchema = z.object({
  reviewId: identity, expectedRevision: z.number().int().positive(), responseId: identity,
  action: z.enum(['reconfigure', 'submit', 'cancel']),
  drafts: z.array(z.object({ requestId: identity, prompt: z.string().nullable(), values: z.record(z.string(), z.json()) }).strict()),
  selectedRoute: z.object({ requestId: identity, route }).strict().optional(),
}).strict();

export const generationReviewConsumeSchema = z.object({ reviewId: identity, responseId: identity }).strict();
