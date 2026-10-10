// Type-only, browser-safe contracts shared by the Codex runtime and the Studio dialogue direction apps.

export type DialogueDirectionPanel = 'eleven-v4' | 'seed-audio';

export interface DialogueLineRange {
  start: number;
  end: number;
}

/** Route ids are opaque to the runtime and echoed back to the agent on consume. */
export interface DialogueDirectionRoute {
  provider: string;
  /** Exact route id for a single-line Take, e.g. `eleven_v4`. */
  speechModel: string;
  /** Exact route id for a multi-line Take, e.g. `eleven_v4/text-to-dialogue`. */
  rangeModel: string;
}

export interface DialogueDirectionSpeakerInput {
  castMemberId: string;
  /** Compatible Cast Voices chosen by the provider Skill. */
  castVoiceIds: string[];
  initialCastVoiceId: string;
}

export interface ElevenV4VoiceSettings {
  /** 0..1 */
  stability: number;
  /** 0..1 */
  similarity: number;
}

export interface ElevenV4DialogueDirectionOpenInput {
  project: string;
  shotPlanId: string;
  route: DialogueDirectionRoute;
  turnRange: DialogueLineRange;
  initialSelection: DialogueLineRange;
  lines: Array<{ number: number; actingScript: string }>;
  speakers: DialogueDirectionSpeakerInput[];
  voiceSettings: ElevenV4VoiceSettings;
  suggestedTags: string[];
}

export type SeedAudioPromptMentions = 'audio-tags' | 'none';

export interface SeedAudioDialogueDirectionOpenInput {
  project: string;
  shotPlanId: string;
  route: DialogueDirectionRoute;
  promptMentions: SeedAudioPromptMentions;
  turnRange: DialogueLineRange;
  initialSelection: DialogueLineRange;
  prompts: Array<{ turnRange: DialogueLineRange; prompt: string }>;
  speakers: DialogueDirectionSpeakerInput[];
}

export interface DialogueDirectionLine {
  number: number;
  castMemberId: string | null;
  speakerName: string;
  isVoiceOver: boolean;
  plainText: string;
  /** `renku-direction://` media URI of the speaker's selected profile image. */
  profileUri: string | null;
}

export interface DialogueDirectionVoice {
  castVoiceId: string;
  name: string;
  /** `renku-direction://` media URI of the voice sample. */
  sampleUri: string;
}

export interface DialogueDirectionTake {
  takeId: string;
  turnRange: DialogueLineRange;
  selected: boolean;
  durationSeconds: number | null;
  /** `renku-direction://` media URI of the Take audio. */
  audioUri: string;
  createdAt: string;
  /** True when the Take's provenance is this session's route (speech or range model). Rail counts and Take lists use only matching Takes; the selected-line indicator considers every Take. */
  matchesRoute: boolean;
  /** Eleven v4 sessions only: acting scripts recovered from Eleven v4 provenance, keyed by line number. */
  actingScripts: Record<number, string> | null;
}

export interface DialogueDirectionAction {
  actionId: string;
  turnRange: DialogueLineRange;
  status: 'pending' | 'running' | 'failed';
  message?: string;
}

export interface ElevenV4DirectionInitial {
  panel: 'eleven-v4';
  selection: DialogueLineRange;
  actingScripts: Record<number, string>;
  voices: Record<string, string>;
  voiceSettings: ElevenV4VoiceSettings;
  suggestedTags: string[];
}

export interface SeedAudioDirectionInitial {
  panel: 'seed-audio';
  selection: DialogueLineRange;
  promptMentions: SeedAudioPromptMentions;
  prompts: Array<{ turnRange: DialogueLineRange; prompt: string }>;
  voices: Record<string, string>;
}

export interface DialogueDirectionSession {
  sessionId: string;
  revision: number;
  panel: DialogueDirectionPanel;
  route: DialogueDirectionRoute;
  shotPlan: { id: string; title: string; sceneHeading: string };
  lines: DialogueDirectionLine[];
  /** Keyed by Cast Member id. */
  voices: Record<string, DialogueDirectionVoice[]>;
  takes: DialogueDirectionTake[];
  action: DialogueDirectionAction | null;
  /** Most recent successful report, retained across resource reads. */
  lastCompletedAction: { actionId: string; takeId: string } | null;
  initial: ElevenV4DirectionInitial | SeedAudioDirectionInitial;
}

export interface ElevenV4DirectionDraft {
  panel: 'eleven-v4';
  /** start === end uses `route.speechModel`; otherwise `route.rangeModel`. */
  turnRange: DialogueLineRange;
  lines: Array<{ number: number; actingScript: string }>;
  voices: Array<{ castMemberId: string; castVoiceId: string }>;
  voiceSettings: ElevenV4VoiceSettings;
}

export interface SeedAudioDirectionDraft {
  panel: 'seed-audio';
  turnRange: DialogueLineRange;
  prompt: string;
  voiceReferences: Array<{ position: 1 | 2 | 3; castMemberId: string; castVoiceId: string }>;
}

export type DialogueDirectionDraft = ElevenV4DirectionDraft | SeedAudioDirectionDraft;

export interface DialogueDirectionGenerateInput {
  sessionId: string;
  draft: DialogueDirectionDraft;
}

export interface DialogueDirectionGenerateReceipt {
  sessionId: string;
  actionId: string;
  turnRange: DialogueLineRange;
  session: DialogueDirectionSession;
}

export interface DialogueDirectionTakeSelectInput {
  sessionId: string;
  takeId: string;
  selected: boolean;
}

export interface DialogueDirectionTakeDiscardInput {
  sessionId: string;
  takeId: string;
}

export interface DialogueDirectionConsumeInput {
  sessionId: string;
  actionId: string;
}

export type DialogueDirectionConsumeResult =
  | {
      status: 'consumed';
      sessionId: string;
      actionId: string;
      project: string;
      shotPlanId: string;
      /** Exact route id the agent must execute for this draft. */
      model: string;
      provider: string;
      draft: DialogueDirectionDraft;
    }
  | { status: 'alreadyConsumed'; sessionId: string; actionId: string };

export type DialogueDirectionReportOutcome =
  /** `assetFile.id` from the `renku media import` report; each audio file belongs to exactly one Take. */
  | { status: 'attached'; assetFileId: string }
  | { status: 'failed'; message: string };

export interface DialogueDirectionReportInput {
  sessionId: string;
  actionId: string;
  outcome: DialogueDirectionReportOutcome;
}
