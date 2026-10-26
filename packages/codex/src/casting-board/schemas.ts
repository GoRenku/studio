import { z } from 'zod';

const boardIdentity = z.string().min(1).max(512);

/** Purpose-level envelope bound of the notes field; not a model fact. */
export const CASTING_BOARD_MAX_NOTES = 2000;

export const castingBoardOpenSchema = z.discriminatedUnion('mode', [
  z.object({
    project: boardIdentity,
    mode: z.literal('candidates').describe('A Look\'s casting rounds.'),
    lookId: boardIdentity,
  }).strict(),
  z.object({
    project: boardIdentity,
    mode: z.literal('sheets').describe('The character sheet rounds of a Look\'s costumes, one costume at a time.'),
    lookId: boardIdentity,
    costumeId: boardIdentity.optional().describe('The costume to show first.'),
  }).strict(),
]);

export const castingBoardActSchema = z.object({
  sessionId: boardIdentity,
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.enum(['hide', 'restore', 'cast']), assetFileId: boardIdentity }).strict(),
    z.object({ kind: z.literal('pickSheet'), costumeId: boardIdentity, assetFileId: boardIdentity }).strict(),
  ]),
}).strict();

export const castingBoardRequestSchema = z.object({
  sessionId: boardIdentity,
  request: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('moreLikeKept'), notes: z.string().max(CASTING_BOARD_MAX_NOTES), costumeId: boardIdentity.optional() }).strict(),
  ]),
}).strict();

export const castingBoardConsumeSchema = z.object({ sessionId: boardIdentity }).strict();
