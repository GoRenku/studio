import fs from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { claimStudioRuntimeDescriptor, createProjectDataService, initRenkuConfig } from '@gorenku/studio-core/server';
import { openCurrentProject } from '@gorenku/studio-core/server/project-selection';
import type { ShotPlanDialogueAudioTake } from '@gorenku/studio-core/client';
import { createCodexServer } from '../server.js';
import type {
  DialogueDirectionConsumeResult,
  DialogueDirectionGenerateReceipt,
  DialogueDirectionSession,
  ElevenV4DialogueDirectionOpenInput,
  ElevenV4DirectionDraft,
  SeedAudioDialogueDirectionOpenInput,
  SeedAudioDirectionDraft,
} from './contracts.js';
import { elevenV4TakeActingScripts } from './eleven-v4/draft.js';

const service = createProjectDataService();
const elevenRoute = { provider: 'elevenlabs', speechModel: 'eleven_v4', rangeModel: 'eleven_v4/text-to-dialogue' };
const seedRoute = { provider: 'fal-ai', speechModel: 'bytedance/seed-audio-1.0', rangeModel: 'bytedance/seed-audio-1.0' };
const speakers = ['ana', 'ben', 'cy', 'dee'] as const;
// Line 1 ana, 2 ben, 3 ana, 4 cy, 5 dee, 6 is spoken by an unlinked character.
const screenplayLines = [['ana', 'First.'], ['ben', 'Second.'], ['ana', 'Third.'], ['cy', 'Fourth.'], ['dee', 'Fifth.'], [null, 'Sixth.']] as const;

let root: string;
let homeDir: string;
let projectFolder: string;
let client: Client;
let server: ReturnType<typeof createCodexServer>;
let shotPlanId: string;
let castIds: Record<(typeof speakers)[number], string>;
let voiceIds: Record<(typeof speakers)[number], string>;
let speechTake: ShotPlanDialogueAudioTake;
let dialogueTake: ShotPlanDialogueAudioTake;
let seedTake: ShotPlanDialogueAudioTake;
let notifications: unknown[];
let notificationServer: Server;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-dialogue-direction-'));
  homeDir = path.join(root, 'home');
  await initRenkuConfig(path.join(root, 'movies'), { homeDir });
  projectFolder = (await service.createMovieProject({ homeDir, projectName: 'movie', title: 'Dialogue direction fixture' })).projectPath;
  await openCurrentProject({ homeDir, projectName: 'movie' });
  await service.applyCastOperations({
    homeDir, projectName: 'movie',
    document: { kind: 'castOperations', operations: speakers.map((handle) => ({ operation: 'castMember.add', castMember: { key: handle, handle, name: handle.toUpperCase() } })) },
  } as never);
  const members = await service.listCastMembers({ homeDir });
  castIds = Object.fromEntries(speakers.map((handle) => [handle, members.find((member) => member.handle === handle)!.id])) as typeof castIds;
  await service.createScreenplay({
    homeDir, projectName: 'movie',
    screenplay: {
      opening: [], sections: [],
      scenes: [{ key: 'scene', heading: 'INT. HALL - NIGHT', blocks: screenplayLines.map(([speaker, text], index) => ({
        key: `line-${index + 1}`, type: 'dialogue', characterName: (speaker ?? 'stranger').toUpperCase(), extensions: [],
        parts: [{ key: `speech-${index + 1}`, type: 'speech', text }],
      })) }],
      structure: [{ key: 'scene-placement', content: { type: 'scene', scene: { key: 'scene' } }, position: 0 }],
      references: screenplayLines.flatMap(([speaker], index) => speaker ? [{
        key: `speaker-${index + 1}`, subject: { type: 'castMember', id: castIds[speaker] },
        target: { type: 'dialogueCue', scene: { key: 'scene' }, turn: { key: `line-${index + 1}` } }, role: 'speaker',
      }] : []),
    },
  } as never);
  await fs.mkdir(path.join(projectFolder, 'tmp'), { recursive: true });
  voiceIds = {} as typeof voiceIds;
  for (const handle of speakers) {
    await fs.writeFile(path.join(projectFolder, `tmp/${handle}.mp3`), `voice ${handle}`);
    const attached = await service.attachCastVoice({ homeDir, projectName: 'movie', document: {
      kind: 'castVoiceFileAttachment', castMemberId: castIds[handle], name: `${handle}-voice`, purpose: 'Dialogue',
      voiceIdentity: { voiceId: `${handle}-id` },
      sample: { sourceProjectRelativePath: `tmp/${handle}.mp3`, title: `${handle} sample` },
    } } as never);
    voiceIds[handle] = attached.voice.id;
  }
  await fs.writeFile(path.join(projectFolder, 'tmp/ana.png'), 'image');
  await service.attachGenerationMedia({
    homeDir, projectName: 'movie', purpose: 'cast.profile', target: { kind: 'castMember', id: castIds.ana },
    sourceProjectRelativePath: 'tmp/ana.png', select: true,
    generationProvenance: { provider: 'fal-ai', model: 'image', mediaKind: 'image', prompt: 'Ana', request: {} },
  } as never);
  const sceneId = (await service.readScreenplayStructure({ homeDir, projectName: 'movie' })).screenplay.scenes[0]!.id;
  shotPlanId = (await service.createShotPlan({
    homeDir, projectName: 'movie', type: 'shot-list', sceneId, title: 'Hall exchange', coverage: null,
    shots: [{ title: 'Held exchange', description: 'Hold the exchange.', brief: {} }],
  } as never)).shotPlan.id;
  speechTake = await attachTake('speech.mp3', { start: 1, end: 1 }, { provider: 'elevenlabs', model: 'eleven_v4', request: { text: '[warm] First.', voice: 'ana-id' } });
  dialogueTake = await attachTake('dialogue.mp3', { start: 1, end: 3 }, { provider: 'elevenlabs', model: 'eleven_v4/text-to-dialogue', request: { inputs: [{ text: '[a] First.', voice: 'ana-id' }, { text: '[b] Second.', voice: 'ben-id' }, { text: '[c] Third.', voice: 'ana-id' }] } });
  seedTake = await attachTake('seed.mp3', { start: 2, end: 2 }, { provider: 'fal-ai', model: 'bytedance/seed-audio-1.0', request: { prompt: 'Second.' } });

  notifications = [];
  notificationServer = createServer(async (request: IncomingMessage, response) => {
    let body = '';
    for await (const chunk of request) body += String(chunk);
    notifications.push(JSON.parse(body));
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ event: { id: 'event' } }));
  });
  await new Promise<void>((resolve) => notificationServer.listen(0, '127.0.0.1', resolve));
  const port = (notificationServer.address() as { port: number }).port;
  await claimStudioRuntimeDescriptor({ homeDir, host: '127.0.0.1', port, serverUrl: `http://127.0.0.1:${port}`, cliNotificationToken: 'token' });

  const html = path.join(root, 'app.html');
  await fs.writeFile(html, '<!doctype html><html><body>Panel</body></html>');
  server = createCodexServer({ version: 'test', generationReviewHtml: html, elevenV4DialogueDirectionHtml: html, seedAudioDialogueDirectionHtml: html, homeDir });
  client = await connectedClient(server, 'codex-mcp-client', { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } });
});

afterAll(async () => {
  await client?.close();
  await server?.close();
  if (notificationServer) await new Promise((resolve) => notificationServer.close(resolve));
  if (root) await fs.rm(root, { recursive: true, force: true });
});

beforeEach(() => {
  notifications.length = 0;
});

async function attachTake(fileName: string, turnRange: { start: number; end: number }, provenance: { provider: string; model: string; request: Record<string, unknown> }) {
  await fs.writeFile(path.join(projectFolder, 'tmp', fileName), fileName);
  const attached = await service.attachGenerationMedia({
    homeDir, projectName: 'movie', purpose: 'shot-plan.dialogue-audio', target: { kind: 'shotPlan', id: shotPlanId },
    sourceProjectRelativePath: `tmp/${fileName}`, turnRange,
    generationProvenance: { ...provenance, mediaKind: 'audio', prompt: null },
  } as never);
  const resource = await service.readShotPlanDialogueAudio({ homeDir, projectName: 'movie', shotPlanId });
  return resource.takes.find((take) => take.assetFile.id === attached.assetFile.id)!;
}

async function connectedClient(target: ReturnType<typeof createCodexServer>, name: string, capabilities: Record<string, unknown>) {
  const connected = new Client({ name, version: '1.0.0' }, { capabilities });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await target.connect(serverTransport);
  await connected.connect(clientTransport);
  return connected;
}

function elevenOpening(): ElevenV4DialogueDirectionOpenInput {
  return {
    project: 'movie', shotPlanId, route: elevenRoute,
    turnRange: { start: 1, end: 3 }, initialSelection: { start: 1, end: 1 },
    lines: [1, 2, 3].map((number) => ({ number, actingScript: `[calm] Line ${number}` })),
    speakers: [
      { castMemberId: castIds.ana, castVoiceIds: [voiceIds.ana], initialCastVoiceId: voiceIds.ana },
      { castMemberId: castIds.ben, castVoiceIds: [voiceIds.ben], initialCastVoiceId: voiceIds.ben },
    ],
    voiceSettings: { stability: 0.5, similarity: 0.75 },
    suggestedTags: ['[calm]', '[whispers]'],
  };
}

function seedOpening(): SeedAudioDialogueDirectionOpenInput {
  return {
    project: 'movie', shotPlanId, route: seedRoute, promptMentions: 'audio-tags',
    turnRange: { start: 1, end: 5 }, initialSelection: { start: 2, end: 4 },
    prompts: [{ turnRange: { start: 2, end: 4 }, prompt: '@Audio1 and @Audio2 argue, then @Audio3 interrupts.' }],
    speakers: speakers.map((handle) => ({ castMemberId: castIds[handle], castVoiceIds: [voiceIds[handle]], initialCastVoiceId: voiceIds[handle] })),
  };
}

function elevenDraft(): ElevenV4DirectionDraft {
  return {
    panel: 'eleven-v4', turnRange: { start: 1, end: 3 },
    lines: [1, 2, 3].map((number) => ({ number, actingScript: `[edited] Line ${number}` })),
    voices: [{ castMemberId: castIds.ana, castVoiceId: voiceIds.ana }, { castMemberId: castIds.ben, castVoiceId: voiceIds.ben }],
    voiceSettings: { stability: 0.4, similarity: 0.8 },
  };
}

async function open(name: 'eleven-v4' | 'seed-audio', input: object): Promise<DialogueDirectionSession> {
  const result = await client.callTool({ name: `dialogue.direction.${name}.open`, arguments: input as Record<string, unknown> });
  expect(result.isError, JSON.stringify(result.structuredContent)).not.toBe(true);
  return (result.structuredContent as { session: DialogueDirectionSession }).session;
}

async function call(name: string, input: object) {
  return client.callTool({ name, arguments: input as Record<string, unknown> });
}

describe('dialogue direction MCP registration', () => {
  it('registers fullscreen-only panel resources and the seven tools with their visibilities', async () => {
    const tools = (await client.listTools()).tools.filter((tool) => tool.name.startsWith('dialogue.direction.'));
    expect(Object.fromEntries(tools.map((tool) => [tool.name, (tool._meta?.ui as { visibility: string[] }).visibility]))).toEqual({
      'dialogue.direction.eleven-v4.open': ['model'],
      'dialogue.direction.seed-audio.open': ['model'],
      'dialogue.direction.generate': ['app'],
      'dialogue.direction.take.select': ['app'],
      'dialogue.direction.take.discard': ['app'],
      'dialogue.direction.consume': ['model'],
      'dialogue.direction.report': ['model'],
    });
    expect(tools.find((tool) => tool.name === 'dialogue.direction.eleven-v4.open')?._meta?.ui).toMatchObject({ resourceUri: 'ui://renku/dialogue-direction/eleven-v4' });
    expect(tools.find((tool) => tool.name === 'dialogue.direction.seed-audio.open')?._meta?.ui).toMatchObject({ resourceUri: 'ui://renku/dialogue-direction/seed-audio' });
    for (const uri of ['ui://renku/dialogue-direction/eleven-v4', 'ui://renku/dialogue-direction/seed-audio']) {
      const resource = await client.readResource({ uri });
      expect(resource.contents[0]).toMatchObject({
        mimeType: RESOURCE_MIME_TYPE,
        _meta: { 'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] }, ui: { csp: { connectDomains: ['blob:'], resourceDomains: ['blob:'] } } },
      });
    }
  });

  it.each([['claude-code', {}], ['codex-mcp-client', {}]])('rejects opening for %s before reading the Project', async (name, capabilities) => {
    const html = path.join(root, 'app.html');
    const isolated = createCodexServer({ version: 'test', generationReviewHtml: html, elevenV4DialogueDirectionHtml: html, seedAudioDialogueDirectionHtml: html, homeDir });
    const isolatedClient = await connectedClient(isolated, name, capabilities);
    try {
      for (const tool of ['eleven-v4', 'seed-audio']) {
        const result = await isolatedClient.callTool({ name: `dialogue.direction.${tool}.open`, arguments: { ...(tool === 'eleven-v4' ? elevenOpening() : seedOpening()), project: 'missing' } as never });
        expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_REVIEW_UNSUPPORTED' } } });
      }
    } finally {
      await isolatedClient.close();
      await isolated.close();
    }
  });
});

describe('opening a session', () => {
  it('projects lines, allowed voices, route Takes and agent drafts', async () => {
    const session = await open('eleven-v4', elevenOpening());
    expect(session).toMatchObject({
      revision: 1, panel: 'eleven-v4', route: elevenRoute, action: null,
      shotPlan: { id: shotPlanId, title: 'Hall exchange', sceneHeading: 'INT. HALL - NIGHT' },
      initial: { panel: 'eleven-v4', selection: { start: 1, end: 1 }, actingScripts: { 1: '[calm] Line 1' }, voices: { [castIds.ana]: voiceIds.ana }, suggestedTags: ['[calm]', '[whispers]'] },
    });
    expect(session.lines.map(({ number, speakerName, castMemberId, plainText }) => ({ number, speakerName, castMemberId, plainText }))).toEqual([
      { number: 1, speakerName: 'ANA', castMemberId: castIds.ana, plainText: 'First.' },
      { number: 2, speakerName: 'BEN', castMemberId: castIds.ben, plainText: 'Second.' },
      { number: 3, speakerName: 'ANA', castMemberId: castIds.ana, plainText: 'Third.' },
    ]);
    expect(session.lines[0]!.profileUri).toMatch(new RegExp(`^renku-direction://${session.sessionId}/media/`));
    expect(session.lines[1]!.profileUri).toBeNull();
    expect(session.voices[castIds.ana]).toEqual([{ castVoiceId: voiceIds.ana, name: 'ana-voice', sampleUri: expect.stringMatching(/^renku-direction:\/\//) }]);
    expect(Object.fromEntries(session.takes.map((take) => [take.takeId, take.matchesRoute]))).toEqual({ [speechTake.id]: true, [dialogueTake.id]: true, [seedTake.id]: false });
    expect(session.takes.find((take) => take.takeId === seedTake.id)).toMatchObject({ matchesRoute: false, actingScripts: null, turnRange: { start: 2, end: 2 } });
    expect(JSON.stringify(session)).not.toContain('.mp3');
  });

  it('collects every opening issue', async () => {
    const input = elevenOpening();
    const result = await call('dialogue.direction.eleven-v4.open', {
      ...input,
      initialSelection: { start: 2, end: 4 },
      lines: [{ number: 1, actingScript: 'a' }, { number: 1, actingScript: 'b' }, { number: 4, actingScript: 'c' }],
      speakers: [
        { castMemberId: castIds.ana, castVoiceIds: [voiceIds.ana, voiceIds.ben], initialCastVoiceId: voiceIds.cy },
        { castMemberId: castIds.dee, castVoiceIds: [voiceIds.dee], initialCastVoiceId: voiceIds.dee },
      ],
    });
    expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });
    const issues = (result.structuredContent as { issues: Array<{ location: { path: string[] }; message: string }> }).issues;
    expect(issues.map((issue) => issue.location.path.join('.')).sort()).toEqual([
      'initialSelection',
      'lines', 'lines', 'lines', 'lines',
      'speakers',
      'speakers.0.castVoiceIds',
      'speakers.0.initialCastVoiceId',
      'speakers.1.castMemberId',
    ].sort());
  });

  it('reports unknown Shot Plans, lines beyond the scene and unlinked speakers', async () => {
    const missingPlan = await call('dialogue.direction.eleven-v4.open', { ...elevenOpening(), shotPlanId: 'shot_plan_missing' });
    expect(missingPlan).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' }, issues: [{ location: { path: ['shotPlanId'] } }] } });
    const missingProject = await call('dialogue.direction.eleven-v4.open', { ...elevenOpening(), project: 'missing' });
    expect(missingProject).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' }, issues: [{ location: { path: ['project'] } }] } });
    const beyond = await call('dialogue.direction.seed-audio.open', { ...seedOpening(), turnRange: { start: 5, end: 9 }, initialSelection: { start: 5, end: 5 }, prompts: [] });
    expect(beyond).toMatchObject({ isError: true, structuredContent: { issues: expect.arrayContaining([expect.objectContaining({ location: { path: ['turnRange'] } })]) } });
    const unlinked = await call('dialogue.direction.seed-audio.open', { ...seedOpening(), turnRange: { start: 5, end: 6 }, initialSelection: { start: 5, end: 6 }, prompts: [], speakers: [seedOpening().speakers[3]] });
    expect((unlinked.structuredContent as { issues: Array<{ message: string }> }).issues.map((issue) => issue.message)).toEqual([expect.stringContaining('Line 6 (STRANGER) has no Cast Member speaker')]);
    const seedRouteMismatch = await call('dialogue.direction.seed-audio.open', { ...seedOpening(), route: elevenRoute, prompts: [{ turnRange: { start: 4, end: 7 }, prompt: '' }] });
    expect((seedRouteMismatch.structuredContent as { issues: Array<{ location: { path: string[] } }> }).issues.map((issue) => issue.location.path.join('.'))).toEqual(['route', 'prompts.0.turnRange']);
  });
});

describe('Generate lifecycle', () => {
  it('records one action, rejects a second, consumes once with the route model and reports attached', async () => {
    const session = await open('eleven-v4', elevenOpening());
    const generated = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: elevenDraft() });
    expect(generated.isError).not.toBe(true);
    const receipt = generated.structuredContent as unknown as DialogueDirectionGenerateReceipt;
    expect(receipt).toMatchObject({ sessionId: session.sessionId, turnRange: { start: 1, end: 3 }, session: { revision: 2, action: { status: 'pending', turnRange: { start: 1, end: 3 } } } });

    const busy = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: elevenDraft() });
    expect(busy).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_BUSY' } } });
    const early = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: dialogueTake.assetFile.id } });
    expect(early).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });

    const consumed = (await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).structuredContent as DialogueDirectionConsumeResult;
    expect(consumed).toEqual({
      status: 'consumed', sessionId: session.sessionId, actionId: receipt.actionId, project: 'movie', shotPlanId,
      provider: 'elevenlabs', model: 'eleven_v4/text-to-dialogue', draft: elevenDraft(),
    });
    expect((await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).structuredContent).toEqual({ status: 'alreadyConsumed', sessionId: session.sessionId, actionId: receipt.actionId });
    expect(await readSession(session.sessionId)).toMatchObject({ action: { status: 'running' } });

    const unknownAsset = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: 'asset_missing' } });
    expect(unknownAsset).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });
    const wrongRange = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: speechTake.assetFile.id } });
    expect(wrongRange).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });

    const attached = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: dialogueTake.assetFile.id } });
    expect(attached.isError).not.toBe(true);
    const completion = { actionId: receipt.actionId, takeId: dialogueTake.id };
    expect((attached.structuredContent as { session: DialogueDirectionSession }).session).toMatchObject({ action: null, lastCompletedAction: completion });
    expect(await readSession(session.sessionId)).toMatchObject({ action: null, lastCompletedAction: completion });
    const again = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'failed', message: 'late' } });
    expect(again).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });
    expect((await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: elevenDraft() })).isError).not.toBe(true);
    expect(await readSession(session.sessionId)).toMatchObject({ action: { status: 'pending' }, lastCompletedAction: completion });
  });

  it('echoes the speech model for one line and re-enables Generate after a failure', async () => {
    const session = await open('eleven-v4', elevenOpening());
    const single: ElevenV4DirectionDraft = { ...elevenDraft(), turnRange: { start: 2, end: 2 }, lines: [{ number: 2, actingScript: '[sharp] Second.' }], voices: [{ castMemberId: castIds.ben, castVoiceId: voiceIds.ben }] };
    const receipt = (await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: single })).structuredContent as unknown as DialogueDirectionGenerateReceipt;
    expect((await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).structuredContent).toMatchObject({ model: 'eleven_v4' });
    const failed = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'failed', message: 'Provider quota exceeded.' } });
    expect((failed.structuredContent as { session: DialogueDirectionSession }).session.action).toEqual({ actionId: receipt.actionId, turnRange: { start: 2, end: 2 }, status: 'failed', message: 'Provider quota exceeded.' });
    expect((await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: single })).isError).not.toBe(true);
  });

  it('fails NOT_FOUND for unknown sessions, actions and media', async () => {
    const session = await open('eleven-v4', elevenOpening());
    for (const [name, input] of [
      ['dialogue.direction.generate', { sessionId: 'missing', draft: elevenDraft() }],
      ['dialogue.direction.consume', { sessionId: 'missing', actionId: 'missing' }],
      ['dialogue.direction.consume', { sessionId: session.sessionId, actionId: 'missing' }],
      ['dialogue.direction.take.select', { sessionId: 'missing', takeId: speechTake.id, selected: true }],
    ] as const) {
      expect(await call(name, input)).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_NOT_FOUND' } } });
    }
    await expect(client.readResource({ uri: 'renku-direction://missing' })).rejects.toMatchObject({ data: { error: { code: 'CODEX_DIALOGUE_DIRECTION_NOT_FOUND' } } });
    await expect(client.readResource({ uri: `renku-direction://${session.sessionId}/media/missing` })).rejects.toMatchObject({ data: { error: { code: 'CODEX_DIALOGUE_DIRECTION_NOT_FOUND' } } });
  });

  it('serves declared media as blobs', async () => {
    const session = await open('eleven-v4', elevenOpening());
    const take = session.takes.find((candidate) => candidate.takeId === speechTake.id)!;
    const audio = (await client.readResource({ uri: take.audioUri })).contents[0] as { mimeType: string; blob: string };
    expect(Buffer.from(audio.blob, 'base64').toString()).toBe('speech.mp3');
    expect(audio.mimeType).toMatch(/^audio\//);
    const sample = (await client.readResource({ uri: session.voices[castIds.ben]![0]!.sampleUri })).contents[0] as { blob: string };
    expect(Buffer.from(sample.blob, 'base64').toString()).toBe('voice ben');
  });
});

async function readSession(sessionId: string): Promise<DialogueDirectionSession> {
  const resource = await client.readResource({ uri: `renku-direction://${sessionId}` });
  return JSON.parse((resource.contents[0] as { text: string }).text) as DialogueDirectionSession;
}

describe('draft validation', () => {
  it('requires Eleven acting scripts for the range in order and one allowed voice per speaker', async () => {
    const session = await open('eleven-v4', elevenOpening());
    const result = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: {
      ...elevenDraft(),
      lines: [{ number: 2, actingScript: 'b' }, { number: 1, actingScript: 'a' }, { number: 3, actingScript: 'c' }],
      voices: [{ castMemberId: castIds.ana, castVoiceId: voiceIds.ben }, { castMemberId: castIds.ana, castVoiceId: voiceIds.ana }, { castMemberId: castIds.cy, castVoiceId: voiceIds.cy }],
    } });
    expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });
    expect((result.structuredContent as { issues: Array<{ location: { path: string[] } }> }).issues.map((issue) => issue.location.path.join('.'))).toEqual([
      'draft.lines', 'draft.voices', 'draft.voices', 'draft.voices.0', 'draft.voices.2',
    ]);
    const outside = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...elevenDraft(), turnRange: { start: 2, end: 4 }, voiceSettings: { stability: 2, similarity: 0.5 } } });
    expect((outside.structuredContent as { issues: Array<{ location: { path: string[] } }> }).issues.map((issue) => issue.location.path.join('.'))).toEqual(['draft.voiceSettings.stability']);
    const range = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...elevenDraft(), turnRange: { start: 2, end: 4 } } });
    expect((range.structuredContent as { issues: Array<{ location: { path: string[] } }> }).issues.map((issue) => issue.location.path.join('.'))).toEqual(['draft.turnRange']);
    const wrongPanel = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { panel: 'seed-audio' } });
    expect(wrongPanel).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });
  });

  it('requires Seed voice references in order of first appearance, sequential and at most three', async () => {
    const session = await open('seed-audio', seedOpening());
    expect(session.takes.map((take) => take.actingScripts)).toEqual([null, null, null]);
    expect(session.takes.filter((take) => take.matchesRoute).map((take) => take.takeId)).toEqual([seedTake.id]);
    const valid: SeedAudioDirectionDraft = {
      panel: 'seed-audio', turnRange: { start: 2, end: 4 }, prompt: '@Audio1 and @Audio2 argue.',
      voiceReferences: [
        { position: 1, castMemberId: castIds.ben, castVoiceId: voiceIds.ben },
        { position: 2, castMemberId: castIds.ana, castVoiceId: voiceIds.ana },
        { position: 3, castMemberId: castIds.cy, castVoiceId: voiceIds.cy },
      ],
    };
    const generated = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: valid });
    expect(generated.isError).not.toBe(true);
    const receipt = generated.structuredContent as unknown as DialogueDirectionGenerateReceipt;
    expect((await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).structuredContent).toMatchObject({ provider: 'fal-ai', model: 'bytedance/seed-audio-1.0', draft: valid });
    await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'failed', message: 'retry' } });

    const reordered = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: {
      ...valid, voiceReferences: [valid.voiceReferences[1], { ...valid.voiceReferences[0], position: 3 }, { ...valid.voiceReferences[2], castVoiceId: voiceIds.dee }],
    } });
    expect((reordered.structuredContent as { issues: Array<{ location: { path: string[] } }> }).issues.map((issue) => issue.location.path.join('.'))).toEqual([
      'draft.voiceReferences.0.position', 'draft.voiceReferences.0.castMemberId',
      'draft.voiceReferences.1.position', 'draft.voiceReferences.1.castMemberId',
      'draft.voiceReferences.2',
    ]);
    const tooMany = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...valid, turnRange: { start: 1, end: 5 } } });
    expect((tooMany.structuredContent as { issues: Array<{ message: string }> }).issues).toEqual([expect.objectContaining({ message: expect.stringContaining('up to 3 voices') })]);
    const missing = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...valid, voiceReferences: valid.voiceReferences.slice(0, 2) } });
    expect((missing.structuredContent as { issues: Array<{ location: { path: string[] } }> }).issues.map((issue) => issue.location.path.join('.'))).toEqual(['draft.voiceReferences']);
  });
});

describe('Take mutations', () => {
  it('selects, clears and discards through Core and notifies Studio as the agent', async () => {
    const session = await open('eleven-v4', elevenOpening());
    const selected = await call('dialogue.direction.take.select', { sessionId: session.sessionId, takeId: speechTake.id, selected: true });
    const selectedTakes = (selected.structuredContent as { session: DialogueDirectionSession }).session.takes;
    expect(Object.fromEntries(selectedTakes.map((take) => [take.takeId, take.selected]))).toEqual({ [speechTake.id]: true, [dialogueTake.id]: false, [seedTake.id]: true });
    const cleared = await call('dialogue.direction.take.select', { sessionId: session.sessionId, takeId: speechTake.id, selected: false });
    expect((cleared.structuredContent as { session: DialogueDirectionSession }).session.takes.find((take) => take.takeId === speechTake.id)?.selected).toBe(false);
    const extra = await attachTake('extra.mp3', { start: 3, end: 3 }, { provider: 'elevenlabs', model: 'eleven_v4', request: { text: 'x' } });
    const discarded = await call('dialogue.direction.take.discard', { sessionId: session.sessionId, takeId: extra.id });
    expect((discarded.structuredContent as { session: DialogueDirectionSession }).session.takes.map((take) => take.takeId)).not.toContain(extra.id);
    expect(notifications).toHaveLength(3);
    expect(notifications[0]).toMatchObject({ source: { kind: 'agent' }, projectRef: { name: 'movie' }, resourceKeys: [`surface:shotPlan:${shotPlanId}:dialogue-audio`] });
    const missing = await call('dialogue.direction.take.select', { sessionId: session.sessionId, takeId: 'take_missing', selected: true });
    expect(missing).toMatchObject({ isError: true, structuredContent: { error: { code: 'CORE_SHOT_PLAN_DIALOGUE_AUDIO_TAKE_INVALID' } } });
  });
});

describe('Eleven v4 acting scripts from provenance', () => {
  it('recovers speech and dialogue scripts and ignores other routes', async () => {
    const session = await open('eleven-v4', elevenOpening());
    expect(session.takes.find((take) => take.takeId === speechTake.id)?.actingScripts).toEqual({ 1: '[warm] First.' });
    expect(session.takes.find((take) => take.takeId === dialogueTake.id)?.actingScripts).toEqual({ 1: '[a] First.', 2: '[b] Second.', 3: '[c] Third.' });
    const withProvenance = (provider: string, model: string, request: unknown, turnRange = { start: 1, end: 1 }) => ({
      ...speechTake, turnRange, assetFile: { ...speechTake.assetFile, generationProvenance: { provider, model, mediaKind: 'audio' as const, prompt: null, request: request as never } },
    });
    expect(elevenV4TakeActingScripts(withProvenance('elevenlabs', 'eleven_v3', { text: 'x' }), elevenRoute)).toBeNull();
    expect(elevenV4TakeActingScripts(withProvenance('fal-ai', 'eleven_v4', { text: 'x' }), elevenRoute)).toBeNull();
    expect(elevenV4TakeActingScripts(withProvenance('elevenlabs', 'eleven_v4/text-to-dialogue', { inputs: [{ text: 'only one' }] }, { start: 1, end: 2 }), elevenRoute)).toBeNull();
    expect(elevenV4TakeActingScripts({ ...speechTake, assetFile: { ...speechTake.assetFile, generationProvenance: null } }, elevenRoute)).toBeNull();
  });
});
