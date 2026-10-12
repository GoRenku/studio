import { z } from 'zod';
import { nativeRequestControlsSchema } from '../native-request-controls/schemas.js';

export const directionIdentity = z.string().min(1).max(512);
const directionLabel = z.string().trim().min(1).max(200);

export const lineRangeSchema = z.object({
  start: z.number().int().positive(),
  end: z.number().int().positive(),
}).strict();

const scriptLocationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), pointer: directionIdentity.describe('JSON Pointer of the direction text in the native request.') }).strict(),
  z.object({
    kind: z.literal('line-list'),
    listPointer: directionIdentity.describe('JSON Pointer of the per-line list in the native request.'),
    textPointer: directionIdentity.describe('JSON Pointer of the direction text inside each list entry.'),
  }).strict(),
]);

const operationSchema = z.object({
  model: directionIdentity.describe('Exact provider route id; opaque to the runtime.'),
  characterLimit: z.number().int().positive().nullable().describe('Advisory direction text limit per Generate; shown as a counter, never enforced.'),
  controls: nativeRequestControlsSchema.describe('Native Request Controls for the native settings the model guide lists, built from the live schema.'),
  scriptLocation: scriptLocationSchema.nullable().describe('Where the native request keeps direction text, so earlier Takes can be reopened.'),
}).strict();

export const directionRouteSchema = z.object({
  provider: directionIdentity.describe('Provider id, echoed back on consume.'),
  providerLabel: directionLabel,
  label: directionLabel.describe('Route index name of the Single-Line route.'),
  scriptLayout: z.enum(['line-scripts', 'range-prompt']),
  voiceBinding: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('speaker-voices') }).strict(),
    z.object({ kind: z.literal('voice-references'), mentions: z.array(z.string().trim().min(1).max(200)).nullable() }).strict(),
  ]),
  maxVoices: z.number().int().min(1),
  emphasis: z.enum(['bracket-tags', 'quoted-spans']).nullable(),
  operations: z.object({ singleLine: operationSchema, lineRange: operationSchema.nullable() }).strict(),
}).strict();

export const directionScriptSchema = z.object({
  turnRange: lineRangeSchema,
  text: z.string(),
}).strict();

export const directionSpeakerSchema = z.object({
  castMemberId: directionIdentity,
  castVoiceIds: z.array(directionIdentity).min(1).describe('Compatible Cast Voices chosen by the provider Skill.'),
  initialCastVoiceId: directionIdentity,
}).strict();

export const dialogueDirectionOpenSchema = z.object({
  project: directionIdentity,
  shotPlanId: directionIdentity,
  route: directionRouteSchema.describe('Route Description copied from the model guide `## Codex panel` block, with labels and live-schema controls.'),
  turnRange: lineRangeSchema.describe('Consecutive screenplay lines shown in the panel.'),
  initialSelection: lineRangeSchema.describe('Initially selected line or range, within turnRange.'),
  speakers: z.array(directionSpeakerSchema).min(1),
  initialScripts: z.array(directionScriptSchema).describe('Line Scripts: one single-line script per line in turnRange. Range Prompt: prefilled prompts for ranges within turnRange.'),
  suggestedTags: z.array(z.string().min(1).max(200)).max(50).describe('Inserted verbatim as chips; never validated.'),
}).strict();

export const dialogueDirectionDraftSchema = z.object({
  turnRange: lineRangeSchema,
  scripts: z.array(directionScriptSchema).min(1),
  voices: z.array(z.object({ castMemberId: directionIdentity, castVoiceId: directionIdentity }).strict()).min(1),
  values: z.record(z.string(), z.json()),
}).strict();

export const dialogueDirectionGenerateSchema = z.object({
  sessionId: directionIdentity,
  draft: z.looseObject({}),
}).strict();

export const dialogueDirectionTakeSelectSchema = z.object({
  sessionId: directionIdentity,
  takeId: directionIdentity,
  selected: z.boolean(),
}).strict();

export const dialogueDirectionTakeDiscardSchema = z.object({
  sessionId: directionIdentity,
  takeId: directionIdentity,
}).strict();

export const dialogueDirectionConsumeSchema = z.object({
  sessionId: directionIdentity,
  actionId: directionIdentity,
}).strict();

export const dialogueDirectionReportSchema = z.object({
  sessionId: directionIdentity,
  actionId: directionIdentity,
  outcome: z.discriminatedUnion('status', [
    z.object({ status: z.literal('attached'), assetFileId: directionIdentity.describe('Asset File id returned by renku media import.') }).strict(),
    z.object({ status: z.literal('failed'), message: z.string().min(1).max(2000) }).strict(),
  ]),
}).strict();
