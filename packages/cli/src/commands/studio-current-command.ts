import { createStudioCoordinationService } from '@gorenku/studio-core/server';
import type { StudioCurrent } from '@gorenku/studio-core/server';
import type { RenkuCliIo } from '../cli.js';

export async function runStudioCurrentCommand(options: {
  input: string[];
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  if (options.input[0] !== 'current') {
    options.io.stderr.error('Usage: renku studio current --json');
    return 1;
  }
  const current = await createStudioCoordinationService({
    homeDir: options.homeDir,
  }).readStudioCurrent();
  if (options.json) {
    options.io.stdout.log(JSON.stringify(current, null, 2));
  } else {
    writeCurrentStudioSummary(options.io, current);
  }
  return 0;
}

function writeCurrentStudioSummary(
  io: RenkuCliIo,
  current: StudioCurrent
): void {
  if (!current.project) {
    io.stdout.log('No active Studio selection is available.');
    return;
  }
  io.stdout.log(`Current Studio project: ${current.project.name}`);
  const focus = focusSummary(current);
  if (focus) {
    io.stdout.log(`Focus: ${focus}`);
  }
}

function focusSummary(current: StudioCurrent): string | null {
  const context = current.context;
  if (!context) {
    return null;
  }
  if (context.kind === 'scene') {
    return [
      `Scene ${context.title}`,
      context.sceneTab.label,
      context.shot?.label,
      context.shot?.activeTab.label,
    ]
      .filter(Boolean)
      .join(' > ');
  }
  switch (context.kind) {
    case 'projectInformation':
      return 'Project Details';
    case 'visualLanguage':
      return 'Visual Language';
    case 'cast':
      return 'Cast';
    case 'castMember':
      return `Cast ${context.name}`;
    case 'locations':
      return 'Locations';
    case 'location':
      return `Location ${context.name}`;
    case 'storyArc':
      return 'Story Arc';
    case 'sequence':
      return `Sequence ${context.title}`;
  }
}
