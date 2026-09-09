import fs from 'node:fs';
import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { PrevisPlayback } from '../../client/shot-plan-previs.js';
import { readOwnedAsset } from '../assets/projection.js';
import { requireAssetOwner } from '../assets/ownership.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { joinProjectRelativePath, normalizeProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { assertResolvedPathInsideProject } from '../project-asset-files/path-guards.js';

export function readPrevisDisplay(session: DatabaseSession, projectFolder: string, sourceDirectory: string) {
  const warnings: DiagnosticIssue[] = [];
  const description = readDisplayFile(projectFolder, sourceDirectory, 'description.md', warnings);
  const json = readDisplayFile(projectFolder, sourceDirectory, 'playback.json', warnings);
  let playback: PrevisPlayback | null = null;
  if (json !== null) {
    try {
      playback = decodePlayback(JSON.parse(json), warnings);
    } catch {
      warnings.push(createDiagnosticWarning('CORE_PREVIS_PLAYBACK_INVALID', 'Previs cues are unavailable: playback.json has an invalid display envelope.', { path: ['playback'] }));
    }
  }
  if (playback?.cues.some((cue) => cue.audio)) {
    playback.cues.forEach((cue, index) => {
      if (!cue.audio) { return; }
      try {
        const asset = readOwnedAsset(session, { assetId: cue.audio.assetId, owner: requireAssetOwner(session, cue.audio.assetId) });
        const file = asset?.files.find((candidate) => candidate.id === cue.audio!.assetFileId);
        if (!file || file.mediaKind !== 'audio' || !file.mimeType?.startsWith('audio/')) { throw new TypeError(); }
        const absolute = resolveProjectRelativePath(projectFolder, file.projectRelativePath);
        assertResolvedPathInsideProject(fs.realpathSync(projectFolder), fs.realpathSync(absolute));
        if (!fs.statSync(absolute).isFile()) { throw new TypeError(); }
        fs.accessSync(absolute, fs.constants.R_OK);
      } catch {
        delete cue.audio;
        warnings.push(createDiagnosticWarning('CORE_PREVIS_AUDIO_UNAVAILABLE', 'Recorded audio is unavailable.', { path: ['playback', 'cues', String(index), 'audio'] }));
      }
    });
  }
  return { description, playback, warnings };
}

function readDisplayFile(projectFolder: string, sourceDirectory: string, name: string, warnings: DiagnosticIssue[]): string | null {
  try {
    const directory = resolveProjectRelativePath(projectFolder, normalizeProjectRelativePath(sourceDirectory));
    const absolute = resolveProjectRelativePath(projectFolder, joinProjectRelativePath(normalizeProjectRelativePath(sourceDirectory), name));
    // Check the retained directory even when the optional file is absent.
    const retained = fs.realpathSync(directory);
    assertResolvedPathInsideProject(fs.realpathSync(projectFolder), retained);
    try { fs.lstatSync(absolute); } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') { return null; }
      throw error;
    }
    assertResolvedPathInsideProject(retained, fs.realpathSync(absolute));
    return fs.readFileSync(absolute, 'utf8');
  } catch {
    warnings.push(createDiagnosticWarning('CORE_PREVIS_DISPLAY_UNAVAILABLE', `${name} is unavailable.`, { path: [name === 'description.md' ? 'description' : 'playback'] }));
    return null;
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { throw new TypeError(); }
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== 'string') { throw new TypeError(); }
  return value;
}

function seconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) { throw new TypeError(); }
  return value;
}

function decodePlayback(value: unknown, warnings: DiagnosticIssue[]): PrevisPlayback {
  const envelope = object(value);
  if (!Array.isArray(envelope.subjects) || !Array.isArray(envelope.cues)) { throw new TypeError(); }
  const subjects = envelope.subjects.map((value) => {
    const subject = object(value);
    const color = string(subject.color);
    if (!/^#[0-9a-f]{6}$/i.test(color)) { throw new TypeError(); }
    return { key: string(subject.key), label: string(subject.label), color };
  });
  if (new Set(subjects.map((subject) => subject.key)).size !== subjects.length) { throw new TypeError(); }
  const cues = envelope.cues.map((value, index) => {
    const cue = object(value);
    const startSeconds = seconds(cue.startSeconds);
    const endSeconds = cue.endSeconds === undefined ? undefined : seconds(cue.endSeconds);
    if (endSeconds !== undefined && endSeconds <= startSeconds) { throw new TypeError(); }
    const audio = decodeAudio(cue.audio, index, warnings);
    return {
      startSeconds,
      ...(endSeconds === undefined ? {} : { endSeconds }),
      ...(cue.subject === undefined ? {} : { subject: string(cue.subject) }),
      text: string(cue.text),
      ...(audio ? { audio } : {}),
    };
  });
  return { subjects, cues };
}

function decodeAudio(value: unknown, index: number, warnings: DiagnosticIssue[]): PrevisPlayback['cues'][number]['audio'] {
  if (value === undefined) { return undefined; }
  try {
    const audio = object(value);
    return {
      assetId: string(audio.assetId), assetFileId: string(audio.assetFileId),
      offsetSeconds: audio.offsetSeconds === undefined ? 0 : seconds(audio.offsetSeconds),
    };
  } catch {
    warnings.push(createDiagnosticWarning('CORE_PREVIS_AUDIO_UNAVAILABLE', 'Recorded audio has an invalid file reference.', { path: ['playback', 'cues', String(index), 'audio'] }));
    return undefined;
  }
}
