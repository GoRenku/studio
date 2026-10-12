// Type-only, browser-safe contracts shared by the Codex runtime and the Studio dialogue direction app.
import type { JsonValue } from '@gorenku/studio-core/client';
import type { NativeRequestControls } from '../native-request-controls/contracts.js';

export interface DialogueLineRange {
  start: number;
  end: number;
}

/** Line Scripts: one direction text per screenplay line. Range Prompt: one direction text for the selected range. */
export type DialogueDirectionScriptLayout = 'line-scripts' | 'range-prompt';

/** Presentation-only highlighting of the route's emphasis syntax. */
export type DialogueDirectionEmphasis = 'bracket-tags' | 'quoted-spans';

export type DialogueDirectionVoiceBinding =
  /** Each speaker is performed by one Cast Voice, sent to the provider by its identity. */
  | { kind: 'speaker-voices' }
  /** Ordered reference samples, one per speaker. `mentions` holds the exact prompt text per reference position; null when the route has no mention syntax. */
  | { kind: 'voice-references'; mentions: string[] | null };

/** Where an operation's native request keeps its direction text. */
export type DialogueDirectionScriptLocation =
  | { kind: 'text'; pointer: string }
  | { kind: 'line-list'; listPointer: string; textPointer: string };

export interface DialogueDirectionOperation {
  /** Exact provider route id; opaque to Codex and Studio. */
  model: string;
  /** Advisory maximum characters of direction text per Generate; shown as a counter, never enforced. */
  characterLimit: number | null;
  controls: NativeRequestControls;
  scriptLocation: DialogueDirectionScriptLocation | null;
}

/** The Skill-supplied Route Description of the selected route. */
export interface DialogueDirectionRoute {
  provider: string;
  providerLabel: string;
  label: string;
  scriptLayout: DialogueDirectionScriptLayout;
  voiceBinding: DialogueDirectionVoiceBinding;
  /** Most distinct voices one Generate may use. */
  maxVoices: number;
  /** null when the route has no emphasis syntax worth highlighting. */
  emphasis: DialogueDirectionEmphasis | null;
  operations: {
    singleLine: DialogueDirectionOperation;
    /** null when the route directs one line per Take. */
    lineRange: DialogueDirectionOperation | null;
  };
}

/** Line Scripts: one single-line script per line. Range Prompt: one script for the whole range. */
export interface DialogueDirectionScript {
  turnRange: DialogueLineRange;
  text: string;
}

export interface DialogueDirectionSpeakerInput {
  castMemberId: string;
  /** Compatible Cast Voices chosen by the provider Skill. */
  castVoiceIds: string[];
  initialCastVoiceId: string;
}

export interface DialogueDirectionOpenInput {
  project: string;
  shotPlanId: string;
  route: DialogueDirectionRoute;
  turnRange: DialogueLineRange;
  initialSelection: DialogueLineRange;
  speakers: DialogueDirectionSpeakerInput[];
  /** Line Scripts: one per line in turnRange. Range Prompt: prefilled prompts for ranges within turnRange. */
  initialScripts: DialogueDirectionScript[];
  /** Inserted verbatim as chips; never validated. */
  suggestedTags: string[];
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
  /** Provenance provider equals route.provider and provenance model is one of the route's operation models. Rail counts and Take lists use only matching Takes; the selected-line indicator considers every Take. */
  matchesRoute: boolean;
  /** Read through the operation's Script Location; null when unavailable. */
  scripts: DialogueDirectionScript[] | null;
}

export interface DialogueDirectionAction {
  actionId: string;
  turnRange: DialogueLineRange;
  status: 'pending' | 'running' | 'failed';
  message?: string;
}

export interface DialogueDirectionSession {
  sessionId: string;
  revision: number;
  route: DialogueDirectionRoute;
  shotPlan: { id: string; title: string; sceneHeading: string };
  lines: DialogueDirectionLine[];
  /** Keyed by Cast Member id. */
  voices: Record<string, DialogueDirectionVoice[]>;
  takes: DialogueDirectionTake[];
  action: DialogueDirectionAction | null;
  /** Most recent successful report, retained across resource reads. */
  lastCompletedAction: { actionId: string; takeId: string } | null;
  initial: {
    selection: DialogueLineRange;
    scripts: DialogueDirectionScript[];
    /** Initial Cast Voice id keyed by Cast Member id. */
    voices: Record<string, string>;
    suggestedTags: string[];
  };
}

export interface DialogueDirectionDraft {
  turnRange: DialogueLineRange;
  /** Direction Scripts covering turnRange, by the route's layout. */
  scripts: DialogueDirectionScript[];
  /** One per speaker in the selected lines, in order of first appearance. The Skill maps position n to `mentions[n - 1]`. */
  voices: Array<{ castMemberId: string; castVoiceId: string }>;
  /** Values of every control of the operation the selection uses, keyed by JSON Pointer. */
  values: Record<string, JsonValue>;
}

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

/** `model` is the operation the draft's range uses. */
export type DialogueDirectionConsumeResult =
  | {
      status: 'consumed';
      sessionId: string;
      actionId: string;
      project: string;
      shotPlanId: string;
      provider: string;
      model: string;
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
