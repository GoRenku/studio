import { z } from 'zod';

const boardIdentity = z.string().min(1).max(512);

/** Purpose-level envelope bound of the notes field; not a model fact. */
export const CASTING_BOARD_MAX_NOTES = 2000;

const SUBJECT_BY_MODE = { candidates: 'lookId', sheets: 'castMemberId' } as const;

export const castingBoardOpenSchema = z.object({
  project: boardIdentity,
  mode: z.enum(['candidates', 'sheets']).describe('candidates shows a Look\'s casting rounds; sheets shows the Cast Member\'s costumes and Character Sheets.'),
  lookId: boardIdentity.optional().describe('Required in candidates mode.'),
  castMemberId: boardIdentity.optional().describe('Required in sheets mode.'),
}).strict().superRefine((input, context) => {
  const required = SUBJECT_BY_MODE[input.mode];
  const other = required === 'lookId' ? 'castMemberId' : 'lookId';
  if (input[required] === undefined) context.addIssue({ code: 'custom', path: [required], message: `${input.mode} mode needs ${required}.` });
  if (input[other] !== undefined) context.addIssue({ code: 'custom', path: [other], message: `${input.mode} mode does not take ${other}.` });
});

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
    z.object({ kind: z.literal('moreLikeKept'), notes: z.string().max(CASTING_BOARD_MAX_NOTES) }).strict(),
    z.object({ kind: z.literal('sheetPicksDone') }).strict(),
  ]),
}).strict();

export const castingBoardConsumeSchema = z.object({ sessionId: boardIdentity }).strict();
