import fs from 'node:fs';
import { validatePrevisPlayback } from './timeline.js';
import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { PrevisPlayback } from '../../client/shot-plan-previs.js';
import { resolveAssetFileInSession } from '../asset-files/resources.js';
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
      const decoded = validatePrevisPlayback(JSON.parse(json));
      playback = decoded.playback;
      warnings.push(...decoded.warnings);
    } catch {
      warnings.push(createDiagnosticWarning('CORE_PREVIS_PLAYBACK_INVALID', 'Previs cues are unavailable: playback.json has an invalid display envelope.', { path: ['playback'] }));
    }
  }
  if (playback?.cues.some((cue) => cue.kind === 'dialogue' && cue.audio)) {
    playback.cues.forEach((cue, index) => {
      if (cue.kind !== 'dialogue' || !cue.audio) { return; }
      try {
        const { assetFile: file } = resolveAssetFileInSession({ session, projectFolder, assetFileId: cue.audio.assetFileId });
        if (!file || file.mediaKind !== 'audio' || !file.mimeType?.startsWith('audio/')) { throw new TypeError(); }
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
