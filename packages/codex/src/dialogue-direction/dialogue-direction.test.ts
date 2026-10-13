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
import { createFakeCostEstimator } from '../testing/fake-cost-estimator.js';
import { createCodexServer } from '../server.js';
import type {
  DialogueDirectionConsumeResult,
  DialogueDirectionDraft,
  DialogueDirectionGenerateReceipt,
  DialogueDirectionOpenInput,
  DialogueDirectionOperation,
  DialogueDirectionRoute,
  DialogueDirectionSession,
} from './contracts.js';
import { takeDirectionScripts } from './take-directions.js';

const service = createProjectDataService();
const warmth = (pointer: string): DialogueDirectionOperation['controls'] => ({ groups: [{ label: 'Voice', fields: [
  { key: pointer, label: 'Warmth', kind: 'number', minimum: 0, maximum: 1, initialValue: 0.5 },
] }] });

// Fictional routes: the runtime must direct any route the Skill describes, with no model knowledge.
const lineRoute: DialogueDirectionRoute = {
  provider: 'acme-audio', providerLabel: 'Acme Audio', label: 'Acme Voice One',
  scriptLayout: 'line-scripts', voiceBinding: { kind: 'speaker-voices' }, maxVoices: 10, emphasis: 'bracket-tags',
  operations: {
    singleLine: { model: 'acme/voice-one', characterLimit: null, controls: warmth('/voice/warmth'), scriptLocation: { kind: 'text', pointer: '/script' } },
    lineRange: { model: 'acme/voice-one/scene', characterLimit: 2000, controls: warmth('/tuning/warmth'), scriptLocation: { kind: 'line-list', listPointer: '/lines', textPointer: '/words' } },
  },
};
const rangeRoute: DialogueDirectionRoute = {
  provider: 'acme-audio', providerLabel: 'Acme Audio', label: 'Acme Ensemble',
  scriptLayout: 'range-prompt', voiceBinding: { kind: 'voice-references', mentions: ['<v1>', '<v2>', '<v3>'] }, maxVoices: 3, emphasis: 'quoted-spans',
  operations: {
    singleLine: { model: 'acme/ensemble', characterLimit: 2048, controls: { groups: [] }, scriptLocation: { kind: 'text', pointer: '/prompt' } },
    lineRange: { model: 'acme/ensemble', characterLimit: 2048, controls: { groups: [] }, scriptLocation: { kind: 'text', pointer: '/prompt' } },
  },
};
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
let ensembleTake: ShotPlanDialogueAudioTake;
let otherTake: ShotPlanDialogueAudioTake;
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
    generationProvenance: { provider: 'acme-images', model: 'image', mediaKind: 'image', prompt: 'Ana', request: {} },
  } as never);
  const sceneId = (await service.readScreenplayStructure({ homeDir, projectName: 'movie' })).screenplay.scenes[0]!.id;
  shotPlanId = (await service.createShotPlan({
    homeDir, projectName: 'movie', type: 'shot-list', sceneId, title: 'Hall exchange', coverage: null,
    shots: [{ title: 'Held exchange', description: 'Hold the exchange.', brief: {} }],
  } as never)).shotPlan.id;
  speechTake = await attachTake('speech.mp3', { start: 1, end: 1 }, { provider: 'acme-audio', model: 'acme/voice-one', request: { script: '[warm] First.', voice: 'ana-id' } });
  dialogueTake = await attachTake('dialogue.mp3', { start: 1, end: 3 }, { provider: 'acme-audio', model: 'acme/voice-one/scene', request: { lines: [{ words: '[a] First.', voice: 'ana-id' }, { words: '[b] Second.', voice: 'ben-id' }, { words: '[c] Third.', voice: 'ana-id' }] } });
  ensembleTake = await attachTake('ensemble.mp3', { start: 2, end: 3 }, { provider: 'acme-audio', model: 'acme/ensemble', request: { prompt: '<v1> "insists", <v2> answers.' } });
  otherTake = await attachTake('other.mp3', { start: 2, end: 2 }, { provider: 'other-audio', model: 'acme/voice-one', request: { script: 'Second.' } });

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
  server = createCodexServer({ version: 'test', generationReviewHtml: html, dialogueDirectionHtml: html, imageEditHtml: html, imageEditTargetChooserHtml: html, routeChooserHtml: html, costEstimator: createFakeCostEstimator(), homeDir });
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

function voicesFor(...handles: Array<(typeof speakers)[number]>) {
  return handles.map((handle) => ({ castMemberId: castIds[handle], castVoiceId: voiceIds[handle] }));
}

function speakerInputs(...handles: Array<(typeof speakers)[number]>) {
  return handles.map((handle) => ({ castMemberId: castIds[handle], castVoiceIds: [voiceIds[handle]], initialCastVoiceId: voiceIds[handle] }));
}

function lineOpening(route: DialogueDirectionRoute = lineRoute): DialogueDirectionOpenInput {
  return {
    project: 'movie', shotPlanId, route,
    turnRange: { start: 1, end: 3 }, initialSelection: { start: 1, end: 1 },
    speakers: speakerInputs('ana', 'ben'),
    initialScripts: [1, 2, 3].map((number) => ({ turnRange: { start: number, end: number }, text: `[calm] Line ${number}` })),
    suggestedTags: ['[calm]', '[whispers]'],
  };
}

function rangeOpening(route: DialogueDirectionRoute = rangeRoute): DialogueDirectionOpenInput {
  return {
    project: 'movie', shotPlanId, route,
    turnRange: { start: 1, end: 5 }, initialSelection: { start: 2, end: 4 },
    speakers: speakerInputs(...speakers),
    initialScripts: [{ turnRange: { start: 2, end: 4 }, text: '<v1> and <v2> argue, then <v3> interrupts.' }],
    suggestedTags: [],
  };
}

function lineDraft(): DialogueDirectionDraft {
  return {
    turnRange: { start: 1, end: 3 },
    scripts: [1, 2, 3].map((number) => ({ turnRange: { start: number, end: number }, text: `[edited] Line ${number}` })),
    voices: voicesFor('ana', 'ben'),
    values: { '/tuning/warmth': 0.8 },
  };
}

function rangeDraft(): DialogueDirectionDraft {
  return {
    turnRange: { start: 2, end: 4 },
    scripts: [{ turnRange: { start: 2, end: 4 }, text: '<v1> and <v2> argue.' }],
    voices: voicesFor('ben', 'ana', 'cy'),
    values: {},
  };
}

async function open(input: DialogueDirectionOpenInput): Promise<DialogueDirectionSession> {
  const result = await call('dialogue.direction.open', input);
  expect(result.isError, JSON.stringify(result.structuredContent)).not.toBe(true);
  return (result.structuredContent as { session: DialogueDirectionSession }).session;
}

async function call(name: string, input: object) {
  return client.callTool({ name, arguments: input as Record<string, unknown> });
}

function issuePaths(result: Awaited<ReturnType<typeof call>>): string[] {
  return (result.structuredContent as { issues: Array<{ location: { path: string[] } }> }).issues.map((issue) => issue.location.path.join('.'));
}

async function generate(sessionId: string, draft: DialogueDirectionDraft): Promise<DialogueDirectionGenerateReceipt> {
  const generated = await call('dialogue.direction.generate', { sessionId, draft });
  expect(generated.isError, JSON.stringify(generated.structuredContent)).not.toBe(true);
  return generated.structuredContent as unknown as DialogueDirectionGenerateReceipt;
}

async function readSession(sessionId: string): Promise<DialogueDirectionSession> {
  const resource = await client.readResource({ uri: `renku-direction://${sessionId}` });
  return JSON.parse((resource.contents[0] as { text: string }).text) as DialogueDirectionSession;
}

describe('dialogue direction MCP registration', () => {
  it('registers one fullscreen-only panel resource and the six tools with their visibilities', async () => {
    const tools = (await client.listTools()).tools.filter((tool) => tool.name.startsWith('dialogue.direction.'));
    expect(Object.fromEntries(tools.map((tool) => [tool.name, (tool._meta?.ui as { visibility: string[] }).visibility]))).toEqual({
      'dialogue.direction.open': ['model'],
      'dialogue.direction.generate': ['app'],
      'dialogue.direction.take.select': ['app'],
      'dialogue.direction.take.discard': ['app'],
      'dialogue.direction.consume': ['model'],
      'dialogue.direction.report': ['model'],
    });
    expect(tools.find((tool) => tool.name === 'dialogue.direction.open')?._meta?.ui).toMatchObject({ resourceUri: 'ui://renku/dialogue-direction' });
    const resource = await client.readResource({ uri: 'ui://renku/dialogue-direction' });
    expect(resource.contents[0]).toMatchObject({
      mimeType: RESOURCE_MIME_TYPE,
      _meta: { 'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] }, ui: { csp: { connectDomains: ['blob:'], resourceDomains: ['blob:'] } } },
    });
  });

  it.each([['claude-code', {}], ['codex-mcp-client', {}]])('rejects opening for %s before reading the Project', async (name, capabilities) => {
    const html = path.join(root, 'app.html');
    const isolated = createCodexServer({ version: 'test', generationReviewHtml: html, dialogueDirectionHtml: html, imageEditHtml: html, imageEditTargetChooserHtml: html, routeChooserHtml: html, costEstimator: createFakeCostEstimator(), homeDir });
    const isolatedClient = await connectedClient(isolated, name, capabilities);
    try {
      const result = await isolatedClient.callTool({ name: 'dialogue.direction.open', arguments: { ...lineOpening(), project: 'missing' } as never });
      expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_REVIEW_UNSUPPORTED' } } });
    } finally {
      await isolatedClient.close();
      await isolated.close();
    }
  });
});

describe('opening a session', () => {
  it('projects the route, lines, allowed voices, route Takes and initial direction', async () => {
    const session = await open(lineOpening());
    expect(session).toMatchObject({
      revision: 1, route: lineRoute, action: null,
      shotPlan: { id: shotPlanId, title: 'Hall exchange', sceneHeading: 'INT. HALL - NIGHT' },
      initial: { selection: { start: 1, end: 1 }, scripts: lineOpening().initialScripts, voices: { [castIds.ana]: voiceIds.ana, [castIds.ben]: voiceIds.ben }, suggestedTags: ['[calm]', '[whispers]'] },
    });
    expect(session.lines.map(({ number, speakerName, castMemberId, plainText }) => ({ number, speakerName, castMemberId, plainText }))).toEqual([
      { number: 1, speakerName: 'ANA', castMemberId: castIds.ana, plainText: 'First.' },
      { number: 2, speakerName: 'BEN', castMemberId: castIds.ben, plainText: 'Second.' },
      { number: 3, speakerName: 'ANA', castMemberId: castIds.ana, plainText: 'Third.' },
    ]);
    expect(session.lines[0]!.profileUri).toMatch(new RegExp(`^renku-direction://${session.sessionId}/media/`));
    expect(session.lines[1]!.profileUri).toBeNull();
    expect(session.voices[castIds.ana]).toEqual([{ castVoiceId: voiceIds.ana, name: 'ana-voice', sampleUri: expect.stringMatching(/^renku-direction:\/\//) }]);
    expect(Object.fromEntries(session.takes.map((take) => [take.takeId, take.matchesRoute]))).toEqual({
      [speechTake.id]: true, [dialogueTake.id]: true, [ensembleTake.id]: false, [otherTake.id]: false,
    });
    expect(session.takes.find((take) => take.takeId === otherTake.id)).toMatchObject({ matchesRoute: false, scripts: null, turnRange: { start: 2, end: 2 } });
    expect(JSON.stringify(session)).not.toContain('.mp3');
  });

  it('collects every opening issue', async () => {
    const result = await call('dialogue.direction.open', {
      ...lineOpening(),
      initialSelection: { start: 2, end: 4 },
      initialScripts: [{ turnRange: { start: 1, end: 2 }, text: 'a' }, { turnRange: { start: 3, end: 3 }, text: 'c' }],
      speakers: [
        { castMemberId: castIds.ana, castVoiceIds: [voiceIds.ana, voiceIds.ben], initialCastVoiceId: voiceIds.cy },
        { castMemberId: castIds.dee, castVoiceIds: [voiceIds.dee], initialCastVoiceId: voiceIds.dee },
      ],
    });
    expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });
    expect(issuePaths(result).sort()).toEqual([
      'initialScripts',
      'initialSelection',
      'speakers',
      'speakers.0.castVoiceIds',
      'speakers.0.initialCastVoiceId',
      'speakers.1.castMemberId',
    ].sort());
  });

  it('reports every Route Description inconsistency together, before reading the Project', async () => {
    const route: DialogueDirectionRoute = {
      ...lineRoute,
      operations: {
        singleLine: {
          ...lineRoute.operations.singleLine,
          scriptLocation: { kind: 'line-list', listPointer: '/lines', textPointer: '/words' },
          controls: { groups: [{ label: 'Voice', fields: [{ key: '/notes', label: 'Notes', kind: 'multiline' }] }] },
        },
        lineRange: { ...lineRoute.operations.lineRange!, scriptLocation: { kind: 'line-list', listPointer: 'lines', textPointer: '/words' } },
      },
    };
    const result = await call('dialogue.direction.open', { ...lineOpening(route), project: 'missing' });
    expect(issuePaths(result)).toEqual([
      'route.operations.singleLine.controls.groups.0.fields.0.kind',
      'route.operations.singleLine.controls.groups.0.fields.0.initialValue',
      'route.operations.singleLine.scriptLocation.kind',
      'route.operations.lineRange.scriptLocation.listPointer',
    ]);
    const mentions = await call('dialogue.direction.open', { ...rangeOpening({ ...rangeRoute, voiceBinding: { kind: 'voice-references', mentions: ['<v1>', '<v1>'] }, operations: { ...rangeRoute.operations, lineRange: { ...rangeRoute.operations.lineRange!, scriptLocation: { kind: 'line-list', listPointer: '/a', textPointer: '/b' } } } }) });
    expect(issuePaths(mentions)).toEqual(['route.voiceBinding.mentions', 'route.voiceBinding.mentions', 'route.operations.lineRange.scriptLocation.kind']);
  });

  it('reports unknown Shot Plans, lines beyond the scene, unlinked speakers and Range Prompt ranges', async () => {
    const missingPlan = await call('dialogue.direction.open', { ...lineOpening(), shotPlanId: 'shot_plan_missing' });
    expect(missingPlan).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' }, issues: [{ location: { path: ['shotPlanId'] } }] } });
    const missingProject = await call('dialogue.direction.open', { ...lineOpening(), project: 'missing' });
    expect(missingProject).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' }, issues: [{ location: { path: ['project'] } }] } });
    const beyond = await call('dialogue.direction.open', { ...rangeOpening(), turnRange: { start: 5, end: 9 }, initialSelection: { start: 5, end: 5 }, initialScripts: [] });
    expect(issuePaths(beyond)).toContain('turnRange');
    const unlinked = await call('dialogue.direction.open', { ...rangeOpening(), turnRange: { start: 5, end: 6 }, initialSelection: { start: 5, end: 6 }, initialScripts: [], speakers: speakerInputs('dee') });
    expect((unlinked.structuredContent as { issues: Array<{ message: string }> }).issues.map((issue) => issue.message)).toEqual([expect.stringContaining('Line 6 (STRANGER) has no Cast Member speaker')]);
    const ranges = await call('dialogue.direction.open', { ...rangeOpening(), initialScripts: [{ turnRange: { start: 4, end: 7 }, text: '' }, { turnRange: { start: 2, end: 3 }, text: 'a' }, { turnRange: { start: 2, end: 3 }, text: 'b' }] });
    expect(issuePaths(ranges)).toEqual(['initialScripts.0.turnRange', 'initialScripts']);
  });
});

describe('Generate lifecycle', () => {
  it('records one action, rejects a second, consumes once with the Line-Range model and reports attached', async () => {
    const session = await open(lineOpening());
    const receipt = await generate(session.sessionId, lineDraft());
    expect(receipt).toMatchObject({ sessionId: session.sessionId, turnRange: { start: 1, end: 3 }, session: { revision: 2, action: { status: 'pending', turnRange: { start: 1, end: 3 } } } });

    const busy = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: lineDraft() });
    expect(busy).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_BUSY' } } });
    const early = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: dialogueTake.assetFile.id } });
    expect(early).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });

    const consumed = (await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).structuredContent as DialogueDirectionConsumeResult;
    expect(consumed).toEqual({
      status: 'consumed', sessionId: session.sessionId, actionId: receipt.actionId, project: 'movie', shotPlanId,
      provider: 'acme-audio', model: 'acme/voice-one/scene', draft: lineDraft(),
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
    await generate(session.sessionId, lineDraft());
    expect(await readSession(session.sessionId)).toMatchObject({ action: { status: 'pending' }, lastCompletedAction: completion });
  });

  it('echoes the Single-Line model for one line and re-enables Generate after a failure', async () => {
    const session = await open(lineOpening());
    const single: DialogueDirectionDraft = { turnRange: { start: 2, end: 2 }, scripts: [{ turnRange: { start: 2, end: 2 }, text: '[sharp] Second.' }], voices: voicesFor('ben'), values: { '/voice/warmth': 0.3 } };
    const receipt = await generate(session.sessionId, single);
    expect((await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).structuredContent).toMatchObject({ model: 'acme/voice-one', draft: single });
    const failed = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'failed', message: 'Provider quota exceeded.' } });
    expect((failed.structuredContent as { session: DialogueDirectionSession }).session.action).toEqual({ actionId: receipt.actionId, turnRange: { start: 2, end: 2 }, status: 'failed', message: 'Provider quota exceeded.' });
    await generate(session.sessionId, single);
  });

  it.each([
    ['line-scripts', 'speaker-voices'],
    ['line-scripts', 'voice-references'],
    ['range-prompt', 'speaker-voices'],
    ['range-prompt', 'voice-references'],
  ] as const)('opens, generates, consumes and reports a %s route with %s', async (scriptLayout, bindingKind) => {
    const base = scriptLayout === 'line-scripts' ? lineRoute : rangeRoute;
    const route: DialogueDirectionRoute = { ...base, maxVoices: 3, voiceBinding: bindingKind === 'speaker-voices' ? { kind: 'speaker-voices' } : { kind: 'voice-references', mentions: null } };
    const session = await open(scriptLayout === 'line-scripts' ? lineOpening(route) : { ...rangeOpening(route), turnRange: { start: 1, end: 3 }, initialSelection: { start: 1, end: 3 }, initialScripts: [], speakers: speakerInputs('ana', 'ben') });
    const draft = scriptLayout === 'line-scripts' ? lineDraft() : { ...rangeDraft(), turnRange: { start: 1, end: 3 }, scripts: [{ turnRange: { start: 1, end: 3 }, text: 'Together.' }], voices: voicesFor('ana', 'ben') };
    const receipt = await generate(session.sessionId, draft);
    expect((await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).structuredContent).toMatchObject({ status: 'consumed', model: route.operations.lineRange!.model, draft });
    const reported = await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'attached', assetFileId: dialogueTake.assetFile.id } });
    expect((reported.structuredContent as { session: DialogueDirectionSession }).session).toMatchObject({ action: null, lastCompletedAction: { takeId: dialogueTake.id } });
  });

  it('fails NOT_FOUND for unknown sessions, actions and media', async () => {
    const session = await open(lineOpening());
    for (const [name, input] of [
      ['dialogue.direction.generate', { sessionId: 'missing', draft: lineDraft() }],
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
    const session = await open(lineOpening());
    const take = session.takes.find((candidate) => candidate.takeId === speechTake.id)!;
    const audio = (await client.readResource({ uri: take.audioUri })).contents[0] as { mimeType: string; blob: string };
    expect(Buffer.from(audio.blob, 'base64').toString()).toBe('speech.mp3');
    expect(audio.mimeType).toMatch(/^audio\//);
    const sample = (await client.readResource({ uri: session.voices[castIds.ben]![0]!.sampleUri })).contents[0] as { blob: string };
    expect(Buffer.from(sample.blob, 'base64').toString()).toBe('voice ben');
  });
});

describe('draft validation', () => {
  it('requires Line Scripts for the range in order and one offered voice per speaker in order of first appearance', async () => {
    const session = await open(lineOpening());
    const result = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: {
      ...lineDraft(),
      scripts: [2, 1, 3].map((number) => ({ turnRange: { start: number, end: number }, text: 'x' })),
      voices: [{ castMemberId: castIds.ana, castVoiceId: voiceIds.ben }, { castMemberId: castIds.cy, castVoiceId: voiceIds.cy }, { castMemberId: castIds.ben, castVoiceId: voiceIds.ben }],
    } });
    expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_DIALOGUE_DIRECTION_INVALID' } } });
    expect(issuePaths(result)).toEqual([
      'draft.scripts', 'draft.voices', 'draft.voices.0', 'draft.voices.1.castMemberId', 'draft.voices.1', 'draft.voices.2.castMemberId',
    ]);
    const range = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...lineDraft(), turnRange: { start: 2, end: 4 } } });
    expect(issuePaths(range)).toEqual(['draft.turnRange']);
  });

  it('requires exactly the active operation\'s control values', async () => {
    const session = await open(lineOpening());
    const wrongOperation = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...lineDraft(), values: { '/voice/warmth': 0.4 } } });
    expect(issuePaths(wrongOperation)).toEqual(['draft.values./tuning/warmth', 'draft.values./voice/warmth']);
    const outOfRange = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...lineDraft(), values: { '/tuning/warmth': 2 } } });
    expect(issuePaths(outOfRange)).toEqual(['draft.values./tuning/warmth']);
  });

  it('requires one Range Prompt script for exactly the selected range', async () => {
    const session = await open(rangeOpening());
    expect(session.takes.filter((take) => take.matchesRoute).map((take) => take.takeId)).toEqual([ensembleTake.id]);
    const receipt = await generate(session.sessionId, rangeDraft());
    expect((await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: receipt.actionId })).structuredContent).toMatchObject({ provider: 'acme-audio', model: 'acme/ensemble', draft: rangeDraft() });
    await call('dialogue.direction.report', { sessionId: session.sessionId, actionId: receipt.actionId, outcome: { status: 'failed', message: 'retry' } });
    const split = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...rangeDraft(), scripts: [{ turnRange: { start: 2, end: 3 }, text: 'a' }] } });
    expect(issuePaths(split)).toEqual(['draft.scripts']);
    const reordered = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: { ...rangeDraft(), voices: voicesFor('ana', 'ben', 'cy') } });
    expect(issuePaths(reordered)).toEqual(['draft.voices.0.castMemberId', 'draft.voices.1.castMemberId']);
  });

  it.each(['speaker-voices', 'voice-references'] as const)('enforces maxVoices for %s', async (kind) => {
    const route: DialogueDirectionRoute = { ...rangeRoute, voiceBinding: kind === 'speaker-voices' ? { kind } : { kind, mentions: null } };
    const session = await open(rangeOpening(route));
    const tooMany = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: {
      ...rangeDraft(), turnRange: { start: 1, end: 5 }, scripts: [{ turnRange: { start: 1, end: 5 }, text: 'All.' }], voices: voicesFor('ana', 'ben', 'cy', 'dee'),
    } });
    expect((tooMany.structuredContent as { issues: Array<{ message: string }> }).issues).toEqual([expect.objectContaining({ message: 'Acme Ensemble takes up to 3 voices; the selected lines have 4 speakers.' })]);
  });

  it('keeps a single-line-only route to one line per Take', async () => {
    const route: DialogueDirectionRoute = { ...lineRoute, maxVoices: 1, emphasis: null, operations: { singleLine: lineRoute.operations.singleLine, lineRange: null } };
    const multi = await call('dialogue.direction.open', { ...lineOpening(route), initialSelection: { start: 1, end: 2 } });
    expect(issuePaths(multi)).toEqual(['initialSelection']);
    const session = await open(lineOpening(route));
    const rejected = await call('dialogue.direction.generate', { sessionId: session.sessionId, draft: lineDraft() });
    expect(issuePaths(rejected)).toEqual(['draft.turnRange']);
    expect((rejected.structuredContent as { issues: Array<{ message: string }> }).issues[0]!.message).toContain('one line per Take');
    const single = await generate(session.sessionId, { turnRange: { start: 3, end: 3 }, scripts: [{ turnRange: { start: 3, end: 3 }, text: 'Third.' }], voices: voicesFor('ana'), values: { '/voice/warmth': 0.5 } });
    expect((await call('dialogue.direction.consume', { sessionId: session.sessionId, actionId: single.actionId })).structuredContent).toMatchObject({ model: 'acme/voice-one' });
  });
});

describe('Take mutations', () => {
  it('selects, clears and discards through Core and notifies Studio as the agent', async () => {
    const session = await open(lineOpening());
    const selected = await call('dialogue.direction.take.select', { sessionId: session.sessionId, takeId: speechTake.id, selected: true });
    const selectedTakes = (selected.structuredContent as { session: DialogueDirectionSession }).session.takes;
    expect(selectedTakes.find((take) => take.takeId === speechTake.id)?.selected).toBe(true);
    const cleared = await call('dialogue.direction.take.select', { sessionId: session.sessionId, takeId: speechTake.id, selected: false });
    expect((cleared.structuredContent as { session: DialogueDirectionSession }).session.takes.find((take) => take.takeId === speechTake.id)?.selected).toBe(false);
    const extra = await attachTake('extra.mp3', { start: 3, end: 3 }, { provider: 'acme-audio', model: 'acme/voice-one', request: { script: 'x' } });
    const discarded = await call('dialogue.direction.take.discard', { sessionId: session.sessionId, takeId: extra.id });
    expect((discarded.structuredContent as { session: DialogueDirectionSession }).session.takes.map((take) => take.takeId)).not.toContain(extra.id);
    expect(notifications).toHaveLength(3);
    expect(notifications[0]).toMatchObject({ source: { kind: 'agent' }, projectRef: { name: 'movie' }, resourceKeys: [`surface:shotPlan:${shotPlanId}:dialogue-audio`] });
    const missing = await call('dialogue.direction.take.select', { sessionId: session.sessionId, takeId: 'take_missing', selected: true });
    expect(missing).toMatchObject({ isError: true, structuredContent: { error: { code: 'CORE_SHOT_PLAN_DIALOGUE_AUDIO_TAKE_INVALID' } } });
  });
});

describe('Direction Scripts from Take provenance', () => {
  it('reopens Takes through text and line-list Script Locations', async () => {
    const lineSession = await open(lineOpening());
    expect(lineSession.takes.find((take) => take.takeId === speechTake.id)?.scripts).toEqual([{ turnRange: { start: 1, end: 1 }, text: '[warm] First.' }]);
    expect(lineSession.takes.find((take) => take.takeId === dialogueTake.id)?.scripts).toEqual([
      { turnRange: { start: 1, end: 1 }, text: '[a] First.' },
      { turnRange: { start: 2, end: 2 }, text: '[b] Second.' },
      { turnRange: { start: 3, end: 3 }, text: '[c] Third.' },
    ]);
    const rangeSession = await open(rangeOpening());
    expect(rangeSession.takes.find((take) => take.takeId === ensembleTake.id)?.scripts).toEqual([{ turnRange: { start: 2, end: 3 }, text: '<v1> "insists", <v2> answers.' }]);
  });

  it('returns null when the location is absent, the list length differs or the Take is from another route', () => {
    const withProvenance = (provider: string, model: string, request: unknown, turnRange = { start: 1, end: 1 }) => ({
      ...speechTake, turnRange, assetFile: { ...speechTake.assetFile, generationProvenance: { provider, model, mediaKind: 'audio' as const, prompt: null, request: request as never } },
    });
    const noLocation: DialogueDirectionRoute = { ...lineRoute, operations: { ...lineRoute.operations, singleLine: { ...lineRoute.operations.singleLine, scriptLocation: null } } };
    expect(takeDirectionScripts(withProvenance('acme-audio', 'acme/voice-one', { script: 'x' }), noLocation)).toBeNull();
    expect(takeDirectionScripts(withProvenance('acme-audio', 'acme/voice-one/scene', { lines: [{ words: 'only one' }] }, { start: 1, end: 2 }), lineRoute)).toBeNull();
    expect(takeDirectionScripts(withProvenance('other-audio', 'acme/voice-one', { script: 'x' }), lineRoute)).toBeNull();
    expect(takeDirectionScripts(withProvenance('acme-audio', 'acme/voice-two', { script: 'x' }), lineRoute)).toBeNull();
    expect(takeDirectionScripts({ ...speechTake, assetFile: { ...speechTake.assetFile, generationProvenance: null } }, lineRoute)).toBeNull();
  });
});
