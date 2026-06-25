import fs from 'node:fs/promises';
import path from 'node:path';
import type { StudioE2eProject } from './studio-e2e-project';

export async function writeStudioE2eProjectFile(input: {
  project: StudioE2eProject;
  projectRelativePath: string;
  contents: string | Buffer;
}): Promise<string> {
  const absolutePath = path.join(
    input.project.projectPath,
    input.projectRelativePath
  );
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.contents);
  return absolutePath;
}

