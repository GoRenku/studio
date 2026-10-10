import { createProjectDataService, type StudioProjectRef } from '@gorenku/studio-core/server';
import type { MediaGenerationContextReport, ShotPlanDialogueAudioTake } from '@gorenku/studio-core/client';
import { isStructuredError, StructuredError } from '@gorenku/studio-diagnostics';
import type { DialogueDirectionLine, DialogueDirectionSession, DialogueDirectionTake, DialogueDirectionVoice, DialogueLineRange } from './contracts.js';
import { directionIssue } from './diagnostics.js';
import type { DialogueDirectionBinding, DialogueDirectionSessionRecord, DialogueDirectionState, DirectionMediaRegistry } from './session-state.js';

export interface DirectionTurn {
  number: number;
  castMemberId: string | null;
  speakerName: string;
  isVoiceOver: boolean;
  plainText: string;
  profilePath: string | null;
}

export interface DirectionCastVoice {
  castVoiceId: string;
  name: string;
  samplePath: string;
}

/** Core facts a dialogue direction session is opened against. */
export interface DirectionContext {
  binding: DialogueDirectionBinding;
  shotPlan: { id: string; title: string; sceneHeading: string };
  turns: DirectionTurn[];
  castVoicesByCastMemberId: Record<string, DirectionCastVoice[]>;
}

export async function readDirectionContext(input: { project: string; shotPlanId: string; homeDir?: string }): Promise<DirectionContext> {
  const service = createProjectDataService();
  const projectRef = await resolveProject(input.project, input.homeDir);
  const context = await readShotPlanContext(projectRef, input.shotPlanId, input.homeDir);
  const target = context.targetContext;
  if (target.kind !== 'shotPlan') throw openingFailure(undefined, ['shotPlanId'], 'The target is not a Shot Plan.');
  const sceneContext = target.sceneContext;
  const speakerIds = [...new Set(sceneContext.dialogueTurns.flatMap((turn) => (turn.castMemberId ? [turn.castMemberId] : [])))];
  const speakers = new Map(await Promise.all(speakerIds.map(async (castMemberId) => [castMemberId, await readSpeaker(service, projectRef.name, castMemberId, input.homeDir)] as const)));
  const assetPaths = new Map(context.assetFiles.map((assetFile) => [assetFile.id, assetFile.projectRelativePath]));
  return {
    binding: { projectRef, shotPlanId: target.shotPlan.id },
    shotPlan: { id: target.shotPlan.id, title: target.shotPlan.title, sceneHeading: sceneContext.scene.heading },
    turns: sceneContext.dialogueTurns.map((turn) => {
      const speaker = turn.castMemberId ? speakers.get(turn.castMemberId) : undefined;
      return {
        number: turn.number,
        castMemberId: turn.castMemberId,
        speakerName: speaker?.name ?? turn.speakerName,
        isVoiceOver: speaker?.isVoiceOver ?? false,
        plainText: turn.plainText,
        profilePath: speaker?.profilePath ?? null,
      };
    }),
    castVoicesByCastMemberId: Object.fromEntries(Object.entries(sceneContext.castVoicesByCastMemberId).map(([castMemberId, voices]) => [
      castMemberId,
      voices.map((voice) => ({ castVoiceId: voice.id, name: voice.name, samplePath: assetPaths.get(voice.sampleAssetFileId)! })),
    ])),
  };
}

export function turnsInRange(turns: DirectionTurn[], range: DialogueLineRange): DirectionTurn[] {
  return turns.filter((turn) => turn.number >= range.start && turn.number <= range.end);
}

export function projectDirectionLines(turns: DirectionTurn[], media: DirectionMediaRegistry): DialogueDirectionLine[] {
  return turns.map(({ profilePath, ...turn }) => ({ ...turn, profileUri: profilePath ? media.uri(profilePath) : null }));
}

/** Projects only the Cast Voices the opening Skill allowed, in its order. */
export function projectDirectionVoices(
  context: DirectionContext,
  speakers: Array<{ castMemberId: string; castVoiceIds: string[] }>,
  media: DirectionMediaRegistry,
): Record<string, DialogueDirectionVoice[]> {
  return Object.fromEntries(speakers.map((speaker) => {
    const voices = context.castVoicesByCastMemberId[speaker.castMemberId] ?? [];
    return [speaker.castMemberId, speaker.castVoiceIds.flatMap((castVoiceId) => {
      const voice = voices.find((candidate) => candidate.castVoiceId === castVoiceId);
      return voice ? [{ castVoiceId, name: voice.name, sampleUri: media.uri(voice.samplePath) }] : [];
    })];
  }));
}

export async function readShotPlanTakes(binding: DialogueDirectionBinding, homeDir?: string): Promise<ShotPlanDialogueAudioTake[]> {
  const resource = await createProjectDataService().readShotPlanDialogueAudio({ projectName: binding.projectRef.name, shotPlanId: binding.shotPlanId, homeDir });
  return resource.takes;
}

export async function readDialogueDirectionSession(state: DialogueDirectionState, sessionId: string, homeDir?: string): Promise<DialogueDirectionSession> {
  const record = state.record(sessionId);
  const takes = await readShotPlanTakes(record.binding, homeDir);
  return projectDialogueDirectionSession(state.record(sessionId), takes);
}

export function projectDialogueDirectionSession(record: DialogueDirectionSessionRecord, takes: ShotPlanDialogueAudioTake[]): DialogueDirectionSession {
  return structuredClone({
    sessionId: record.sessionId,
    revision: record.revision,
    panel: record.panel,
    route: record.route,
    shotPlan: record.shotPlan,
    lines: record.lines,
    voices: record.voices,
    takes: takes.map((take) => projectTake(take, record)).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    action: record.action,
    lastCompletedAction: record.lastCompletedAction,
    initial: record.initial,
  });
}

function matchesRoute(take: ShotPlanDialogueAudioTake, record: DialogueDirectionSessionRecord): boolean {
  const provenance = take.assetFile.generationProvenance;
  return provenance?.provider === record.route.provider && [record.route.speechModel, record.route.rangeModel].includes(provenance.model);
}

function projectTake(take: ShotPlanDialogueAudioTake, record: DialogueDirectionSessionRecord): DialogueDirectionTake {
  const routeTake = matchesRoute(take, record);
  return {
    takeId: take.id,
    turnRange: take.turnRange,
    selected: take.selected,
    durationSeconds: take.assetFile.durationSeconds,
    audioUri: record.media.uri(take.assetFile.projectRelativePath),
    createdAt: take.createdAt,
    matchesRoute: routeTake,
    actingScripts: routeTake ? record.takeActingScripts?.(take, record.route) ?? null : null,
  };
}

async function resolveProject(project: string, homeDir?: string): Promise<StudioProjectRef> {
  try {
    return await createProjectDataService().resolveStudioProjectRef({ projectName: project, homeDir });
  } catch (error) {
    throw openingFailure(error, ['project'], `Project ${project} could not be resolved.`);
  }
}

async function readShotPlanContext(projectRef: StudioProjectRef, shotPlanId: string, homeDir?: string): Promise<MediaGenerationContextReport> {
  try {
    return await createProjectDataService().readMediaGenerationContext({
      projectName: projectRef.name, homeDir, purpose: 'shot-plan.dialogue-audio', target: { kind: 'shotPlan', id: shotPlanId },
    });
  } catch (error) {
    if (isStructuredError(error) && error.code === 'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND') {
      throw openingFailure(error, ['shotPlanId'], `Shot Plan ${shotPlanId} does not exist.`);
    }
    throw error;
  }
}

async function readSpeaker(service: ReturnType<typeof createProjectDataService>, projectName: string, castMemberId: string, homeDir?: string) {
  const resource = await service.readCastMemberResource({ projectName, castMemberId, homeDir });
  const profileId = resource.firstImage?.assetFileId;
  const images = profileId ? await service.listAssetFiles({ projectName, homeDir, owner: { kind: 'castMember', id: castMemberId }, mediaKind: 'image' }) : [];
  return {
    name: resource.castMember.name,
    isVoiceOver: resource.castMember.isVoiceOver,
    profilePath: images.find((image) => image.id === profileId)?.projectRelativePath ?? null,
  };
}

function openingFailure(cause: unknown, path: string[], message: string): StructuredError {
  const issue = directionIssue(path, isStructuredError(cause) ? `${message} [${cause.code}] ${cause.message}` : message);
  return new StructuredError({ code: 'CODEX_DIALOGUE_DIRECTION_INVALID', message: 'The dialogue direction panel cannot open.', issues: [issue] });
}
