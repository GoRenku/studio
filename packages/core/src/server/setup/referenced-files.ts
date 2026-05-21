import {
  buildDiagnosticResult,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ProjectSetup,
  ProjectSetupClip,
  ProjectSetupScene,
  ProjectSetupSequence,
} from './contracts.js';
import {
  addProjectSetupError,
  formatProjectSetupPath,
  isNodeError,
  type ProjectSetupReaderContext,
} from './reader-fields.js';

export interface ProjectSetupResolvedFiles {
  setup: ProjectSetup;
  coverPath?: string;
}

export async function loadReferencedProjectSetupFiles(
  setup: ProjectSetup,
  setupPath: string,
  existingIssues: DiagnosticIssue[]
): Promise<ProjectSetupResolvedFiles> {
  const context: ProjectSetupReaderContext = {
    filePath: setupPath,
    issues: [...existingIssues],
  };
  const setupDir = path.dirname(setupPath);

  const projectSummary =
    (await readReferencedMarkdownFile(context, {
      setupDir,
      filePath: setup.project.summaryFile,
      yamlPath: ['project', 'summaryFile'],
      label: 'project summary',
    })) ?? setup.project.summary;
  const coverPath = await resolveReferencedPngFile(context, {
    setupDir,
    filePath: setup.project.coverFile,
    yamlPath: ['project', 'coverFile'],
    label: 'project cover',
  });

  const visualLanguage = await Promise.all(
    (setup.visualLanguage ?? []).map(async (entry, index) => ({
      ...entry,
      guidance:
        (await readReferencedMarkdownFile(context, {
          setupDir,
          filePath: entry.guidanceFile,
          yamlPath: ['visualLanguage', String(index), 'guidanceFile'],
          label: `${entry.name} guidance`,
        })) ?? entry.guidance,
      prompt:
        (await readReferencedMarkdownFile(context, {
          setupDir,
          filePath: entry.promptFile,
          yamlPath: ['visualLanguage', String(index), 'promptFile'],
          label: `${entry.name} prompt`,
        })) ?? entry.prompt,
    }))
  );

  const cast = await Promise.all(
    (setup.cast ?? []).map(async (entry, index) => ({
      ...entry,
      description:
        (await readReferencedMarkdownFile(context, {
          setupDir,
          filePath: entry.descriptionFile,
          yamlPath: ['cast', String(index), 'descriptionFile'],
          label: `${entry.name} description`,
        })) ?? entry.description,
    }))
  );

  const continuityReferences = await Promise.all(
    (setup.continuityReferences ?? []).map(async (entry, index) => ({
      ...entry,
      description:
        (await readReferencedMarkdownFile(context, {
          setupDir,
          filePath: entry.descriptionFile,
          yamlPath: ['continuityReferences', String(index), 'descriptionFile'],
          label: `${entry.name} description`,
        })) ?? entry.description,
    }))
  );

  const episodes = await Promise.all(
    (setup.episodes ?? []).map(async (episode, episodeIndex) => ({
      ...episode,
      summary:
        (await readReferencedMarkdownFile(context, {
          setupDir,
          filePath: episode.summaryFile,
          yamlPath: ['episodes', String(episodeIndex), 'summaryFile'],
          label: `${episode.title} summary`,
        })) ?? episode.summary,
      sequences: await loadReferencedSequences({
        context,
        setupDir,
        sequences: episode.sequences ?? [],
        yamlPath: ['episodes', String(episodeIndex), 'sequences'],
      }),
    }))
  );

  const sequences = await loadReferencedSequences({
    context,
    setupDir,
    sequences: setup.sequences ?? [],
    yamlPath: ['sequences'],
  });

  const result = buildDiagnosticResult(context.issues);
  throwIfDiagnosticResultInvalid(result, {
    code: 'PROJECT_SETUP999',
    message: 'Project setup YAML failed validation.',
    suggestion: 'Fix the reported project setup errors and run the command again.',
  });

  return {
    setup: {
      ...setup,
      project: {
        ...setup.project,
        summary: projectSummary,
      },
      cast,
      visualLanguage,
      continuityReferences,
      episodes,
      sequences,
    },
    coverPath,
  };
}

async function loadReferencedSequences(input: {
  context: ProjectSetupReaderContext;
  setupDir: string;
  sequences: ProjectSetupSequence[];
  yamlPath: string[];
}): Promise<ProjectSetupSequence[]> {
  return await Promise.all(
    input.sequences.map(async (sequence, sequenceIndex) => ({
      ...sequence,
      summary:
        (await readReferencedMarkdownFile(input.context, {
          setupDir: input.setupDir,
          filePath: sequence.summaryFile,
          yamlPath: [...input.yamlPath, String(sequenceIndex), 'summaryFile'],
          label: `${sequence.title} summary`,
        })) ?? sequence.summary,
      scenes: await loadReferencedScenes({
        context: input.context,
        setupDir: input.setupDir,
        scenes: sequence.scenes ?? [],
        yamlPath: [...input.yamlPath, String(sequenceIndex), 'scenes'],
      }),
    }))
  );
}

async function loadReferencedScenes(input: {
  context: ProjectSetupReaderContext;
  setupDir: string;
  scenes: ProjectSetupScene[];
  yamlPath: string[];
}): Promise<ProjectSetupScene[]> {
  return await Promise.all(
    input.scenes.map(async (scene, sceneIndex) => ({
      ...scene,
      summary:
        (await readReferencedMarkdownFile(input.context, {
          setupDir: input.setupDir,
          filePath: scene.summaryFile,
          yamlPath: [...input.yamlPath, String(sceneIndex), 'summaryFile'],
          label: `${scene.title} summary`,
        })) ?? scene.summary,
      clips: await loadReferencedClips({
        context: input.context,
        setupDir: input.setupDir,
        clips: scene.clips ?? [],
        yamlPath: [...input.yamlPath, String(sceneIndex), 'clips'],
      }),
    }))
  );
}

async function loadReferencedClips(input: {
  context: ProjectSetupReaderContext;
  setupDir: string;
  clips: ProjectSetupClip[];
  yamlPath: string[];
}): Promise<ProjectSetupClip[]> {
  return await Promise.all(
    input.clips.map(async (clip, clipIndex) => ({
      ...clip,
      summary:
        (await readReferencedMarkdownFile(input.context, {
          setupDir: input.setupDir,
          filePath: clip.summaryFile,
          yamlPath: [...input.yamlPath, String(clipIndex), 'summaryFile'],
          label: `${clip.title} summary`,
        })) ?? clip.summary,
      visualIntent:
        (await readReferencedMarkdownFile(input.context, {
          setupDir: input.setupDir,
          filePath: clip.visualIntentFile,
          yamlPath: [...input.yamlPath, String(clipIndex), 'visualIntentFile'],
          label: `${clip.title} visual intent`,
        })) ?? clip.visualIntent,
    }))
  );
}

async function readReferencedMarkdownFile(
  context: ProjectSetupReaderContext,
  input: {
    setupDir: string;
    filePath?: string;
    yamlPath: string[];
    label: string;
  }
): Promise<string | undefined> {
  if (!input.filePath?.trim()) {
    return undefined;
  }
  const resolvedPath = resolveSetupRelativeFile(context, {
    setupDir: input.setupDir,
    filePath: input.filePath,
    yamlPath: input.yamlPath,
    relativeSuggestion:
      'Use a setup-relative Markdown path such as screenplay/sequence-summary.md.',
    insideSuggestion:
      'Move the Markdown file under the setup directory and reference it with a relative path.',
  });
  if (!resolvedPath) {
    return undefined;
  }
  try {
    return await fs.readFile(resolvedPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      addProjectSetupError(
        context,
        'PROJECT_SETUP007',
        `Referenced Markdown file for ${input.label} does not exist: ${input.filePath}.`,
        input.yamlPath,
        'Create the referenced Markdown file or update the setup path.'
      );
      return undefined;
    }
    throw error;
  }
}

async function resolveReferencedPngFile(
  context: ProjectSetupReaderContext,
  input: {
    setupDir: string;
    filePath?: string;
    yamlPath: string[];
    label: string;
  }
): Promise<string | undefined> {
  if (!input.filePath?.trim()) {
    return undefined;
  }
  const resolvedPath = resolveSetupRelativeFile(context, {
    setupDir: input.setupDir,
    filePath: input.filePath,
    yamlPath: input.yamlPath,
    relativeSuggestion: 'Use a setup-relative PNG path such as screenplay/cover.png.',
    insideSuggestion:
      'Move the PNG file under the setup directory and reference it with a relative path.',
  });
  if (!resolvedPath) {
    return undefined;
  }
  if (path.extname(resolvedPath).toLowerCase() !== '.png') {
    addProjectSetupError(
      context,
      'PROJECT_SETUP009',
      `${formatProjectSetupPath(input.yamlPath)} must reference a PNG file.`,
      input.yamlPath,
      'Use a .png file for the project cover.'
    );
    return undefined;
  }
  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      addProjectSetupError(
        context,
        'PROJECT_SETUP010',
        `Referenced PNG file for ${input.label} is not a file: ${input.filePath}.`,
        input.yamlPath,
        'Point project.coverFile at a PNG file.'
      );
      return undefined;
    }
    return resolvedPath;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      addProjectSetupError(
        context,
        'PROJECT_SETUP007',
        `Referenced PNG file for ${input.label} does not exist: ${input.filePath}.`,
        input.yamlPath,
        'Create the referenced PNG file or update the setup path.'
      );
      return undefined;
    }
    throw error;
  }
}

function resolveSetupRelativeFile(
  context: ProjectSetupReaderContext,
  input: {
    setupDir: string;
    filePath: string;
    yamlPath: string[];
    relativeSuggestion: string;
    insideSuggestion: string;
  }
): string | null {
  if (path.isAbsolute(input.filePath)) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP006',
      `${formatProjectSetupPath(input.yamlPath)} must be relative to the setup file.`,
      input.yamlPath,
      input.relativeSuggestion
    );
    return null;
  }

  const resolvedPath = path.resolve(input.setupDir, input.filePath);
  const relativePath = path.relative(input.setupDir, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    addProjectSetupError(
      context,
      'PROJECT_SETUP006',
      `${formatProjectSetupPath(input.yamlPath)} must stay inside the setup directory.`,
      input.yamlPath,
      input.insideSuggestion
    );
    return null;
  }
  return resolvedPath;
}
