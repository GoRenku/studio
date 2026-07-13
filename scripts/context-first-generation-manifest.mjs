import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const gitRefIndex = process.argv.indexOf('--git-ref');
const gitRef = gitRefIndex >= 0 ? process.argv[gitRefIndex + 1] : null;
const trackedFiles = execFileSync(
  gitRef ? 'git' : 'rg',
  gitRef ? ['ls-tree', '-r', '--name-only', gitRef] : ['--files'],
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

const files = trackedFiles
  .filter(isGenerationScopeFile)
  .map((file) => {
    const contents = readContents(file);
    return {
      path: file,
      kind: isTestFile(file) ? 'test' : 'production',
      lines: contents === '' ? 0 : contents.split('\n').length,
    };
  })
  .filter((entry) => entry.lines > 0)
  .sort((left, right) => left.path.localeCompare(right.path));

const totals = files.reduce(
  (summary, file) => {
    summary[file.kind].files += 1;
    summary[file.kind].lines += file.lines;
    return summary;
  },
  {
    production: { files: 0, lines: 0 },
    test: { files: 0, lines: 0 },
  }
);

const result = process.argv.includes('--summary')
  ? { gitRef, totals }
  : { gitRef, totals, files };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function readContents(file) {
  return gitRef
    ? execFileSync('git', ['show', `${gitRef}:${file}`], { encoding: 'utf8' })
    : readFileSync(file, 'utf8');
}

function isGenerationScopeFile(file) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return false;
  }
  if (
    file.startsWith('packages/core/src/server/media-generation/') ||
    file.startsWith('packages/core/src/server/generation-preview/') ||
    file.startsWith('packages/core/src/server/generation-preview-resource/') ||
    file.startsWith('packages/core/src/server/generation/') ||
    file.startsWith('packages/core/src/server/image-revision-workflow/') ||
    file.startsWith('packages/core/src/server/scene-dialogue-audio-workspace/') ||
    file.startsWith('packages/core/src/server/shot-video-take-workspace/') ||
    file === 'packages/core/src/server/database/access/generation-references.ts'
  ) {
    return true;
  }
  if (
    file.startsWith('packages/core/src/client/') &&
    (
      file.includes('generation') ||
      file.includes('image-revision-workflow') ||
      file.includes('scene-dialogue-audio-workspace') ||
      file.includes('shot-video-take-workspace')
    )
  ) {
    return true;
  }
  if (
    file.startsWith('packages/engines/src/shot-video/') ||
    file.startsWith('packages/engines/src/generation/')
  ) {
    return true;
  }
  if (
    file.startsWith('packages/cli/src/commands/') ||
    file.startsWith('packages/studio/server/') ||
    file.startsWith('packages/studio/src/') ||
    file.includes('/shot-video-take/')
  ) {
    const contents = readContents(file);
    return /media-generation|generation-preview|generation dependency|GenerationPreview|MediaGeneration|ImageRevision|SceneDialogueAudio|ShotVideoTake/i.test(contents);
  }
  return false;
}

function isTestFile(file) {
  return /(?:\.test\.|\.spec\.|\/tests?\/)/.test(file);
}
