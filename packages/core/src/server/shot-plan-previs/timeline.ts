import { createDiagnosticError, createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { PrevisCue, PrevisDialogueAudio, PrevisFrameRate, PrevisPlayback } from '../../client/shot-plan-previs.js';
import { ProjectDataError } from '../project-data-error.js';

type Fields = Record<string, unknown>;
const object = (value: unknown): Fields | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
const text = (value: unknown): value is string => typeof value === 'string';
const identity = (value: unknown): value is string => text(value) && value.trim().length > 0;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function previsFrameToSeconds(frame: number, rate: PrevisFrameRate): number {
  return frame * rate.denominator / rate.numerator;
}

export function validatePrevisPlayback(value: unknown): { playback: PrevisPlayback; warnings: DiagnosticIssue[] } {
  const issues: DiagnosticIssue[] = [];
  const warnings: DiagnosticIssue[] = [];
  const issue = (path: string[], message: string) => issues.push(createDiagnosticError('CORE_PREVIS_PLAYBACK_INVALID', message, { path: ['playback', ...path] }));
  const envelope = object(value) ?? {};
  const rate = object(envelope.frameRate);
  if (!rate || !integer(rate.numerator) || rate.numerator === 0 || !integer(rate.denominator) || rate.denominator === 0) {
    issue(['frameRate'], 'Frame rate requires positive safe-integer numerator and denominator.');
  }
  const frameRate = { numerator: Number(rate?.numerator), denominator: Number(rate?.denominator) };
  const frameCount = Number(envelope.frameCount);
  if (!integer(envelope.frameCount) || frameCount === 0 || !Number.isSafeInteger(frameCount * frameRate.denominator)) {
    issue(['frameCount'], 'Frame count must be a positive safe integer with safely representable timing.');
  }
  const array = (key: string): unknown[] => {
    if (Array.isArray(envelope[key])) { return envelope[key]; }
    issue([key], 'Expected an array.');
    return [];
  };
  const unique = (key: unknown, keys: Set<string>, path: string[]) => {
    if (!identity(key) || keys.has(key)) { issue(path, 'Expected a unique nonempty identifier.'); return; }
    keys.add(key);
  };
  const position = (frame: unknown, path: string[]) => {
    if (!integer(frame) || frame >= frameCount) { issue(path, 'Start frame must be inside the timeline.'); }
  };
  const subjectKeys = new Set<string>();
  const subjects = array('subjects').map((value, index) => {
    const subject = object(value) ?? {};
    const path = ['subjects', String(index)];
    unique(subject.key, subjectKeys, [...path, 'key']);
    if (!text(subject.label)) { issue([...path, 'label'], 'Expected an authored label.'); }
    if (!text(subject.color) || !/^#[0-9a-f]{6}$/i.test(subject.color)) { issue([...path, 'color'], 'Expected a six-digit hex color.'); }
    return { key: subject.key as string, label: subject.label as string, color: subject.color as string };
  });
  const segmentKeys = new Set<string>();
  let previous = -1;
  const segments = array('segments').map((value, index) => {
    const segment = object(value) ?? {};
    const path = ['segments', String(index)];
    unique(segment.id, segmentKeys, [...path, 'id']);
    position(segment.startFrame, [...path, 'startFrame']);
    if (index === 0 ? segment.startFrame !== 0 : Number(segment.startFrame) <= previous) {
      issue([...path, 'startFrame'], 'Segments must start at zero and then increase strictly.');
    }
    previous = Number(segment.startFrame);
    if (!identity(segment.label)) { issue([...path, 'label'], 'Expected a nonempty authored segment label.'); }
    return { id: segment.id as string, startFrame: segment.startFrame as number, label: segment.label as string };
  });
  if (!segments.length) { issue(['segments'], 'At least one shot segment is required.'); }
  const cueKeys = new Set<string>();
  const cues = array('cues').flatMap((value, index): PrevisCue[] => {
    const cue = object(value) ?? {};
    const path = ['cues', String(index)];
    unique(cue.id, cueKeys, [...path, 'id']);
    position(cue.startFrame, [...path, 'startFrame']);
    if (!text(cue.text)) { issue([...path, 'text'], 'Expected authored text.'); }
    const base = { id: cue.id as string, startFrame: cue.startFrame as number, text: cue.text as string };
    const reference = (key: 'speaker' | 'subject') => {
      if (!identity(cue[key]) || !subjectKeys.has(cue[key] as string)) { issue([...path, key], 'Subject must reference a key in this timeline.'); }
    };
    if (cue.kind === 'dialogue') {
      reference('speaker');
      if (cue.endFrame !== undefined && (!integer(cue.endFrame) || cue.endFrame <= base.startFrame || cue.endFrame > frameCount)) {
        issue([...path, 'endFrame'], 'Dialogue end must follow its start and be no later than the timeline end.');
      }
      const audio = decodeAudio(cue.audio, path, warnings);
      return [{ ...base, kind: 'dialogue', speaker: cue.speaker as string,
        ...(cue.endFrame === undefined ? {} : { endFrame: cue.endFrame as number }), ...(audio ? { audio } : {}) }];
    }
    if (cue.kind === 'action' || cue.kind === 'camera') {
      for (const field of ['endFrame', 'audio', 'speaker', ...(cue.kind === 'camera' ? ['subject'] : [])]) {
        if (cue[field] !== undefined) { issue([...path, field], `${cue.kind} points cannot contain ${field}.`); }
      }
      if (cue.kind === 'camera') { return [{ ...base, kind: 'camera' }]; }
      if (cue.subject !== undefined) { reference('subject'); }
      return [{ ...base, kind: 'action', ...(cue.subject === undefined ? {} : { subject: cue.subject as string }) }];
    }
    issue([...path, 'kind'], 'Expected dialogue, action or camera.');
    return [];
  });
  if (issues.length) { throw new ProjectDataError('CORE_PREVIS_PLAYBACK_INVALID', 'Previs timeline failed validation.', { issues }); }
  return { playback: { frameRate, frameCount, segments, subjects, cues }, warnings };
}

function decodeAudio(value: unknown, path: string[], warnings: DiagnosticIssue[]): PrevisDialogueAudio | undefined {
  if (value === undefined) { return undefined; }
  const audio = object(value);
  if (!audio || !identity(audio.assetId) || !identity(audio.assetFileId)
    || (audio.offsetSeconds !== undefined && (typeof audio.offsetSeconds !== 'number' || !Number.isFinite(audio.offsetSeconds) || audio.offsetSeconds < 0))) {
    warnings.push(createDiagnosticWarning('CORE_PREVIS_AUDIO_UNAVAILABLE', 'Recorded audio has an invalid file reference.', { path: ['playback', ...path, 'audio'] }));
    return undefined;
  }
  return { assetId: audio.assetId, assetFileId: audio.assetFileId, offsetSeconds: audio.offsetSeconds as number | undefined };
}
