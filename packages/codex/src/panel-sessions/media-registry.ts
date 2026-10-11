import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import type { StructuredError } from '@gorenku/studio-diagnostics';
import { readMediaGenerationReferenceProjectFile, type StudioProjectRef } from '@gorenku/studio-core/server';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/** Opaque per-session media ids for project files a panel may read. */
export class PanelMediaRegistry {
  private readonly paths = new Map<string, string>();
  private readonly ids = new Map<string, string>();

  constructor(private readonly scheme: string, private readonly sessionId: string) {}

  uri(projectRelativePath: string): string {
    let mediaId = this.ids.get(projectRelativePath);
    if (!mediaId) {
      mediaId = randomUUID();
      this.ids.set(projectRelativePath, mediaId);
      this.paths.set(mediaId, projectRelativePath);
    }
    return `${this.scheme}://${this.sessionId}/media/${mediaId}`;
  }

  path(mediaId: string): string | undefined {
    return this.paths.get(mediaId);
  }
}

export interface PanelMediaSource {
  projectRef: StudioProjectRef;
  media: PanelMediaRegistry;
}

/** Serves `<scheme>://{sessionId}/media/{mediaId}` as a base64 blob of the registered project file. */
export async function readPanelMedia(input: {
  uri: string;
  scheme: string;
  source: (sessionId: string) => PanelMediaSource;
  notFound: () => StructuredError;
  homeDir?: string;
}): Promise<ReadResourceResult> {
  const parsed = new URL(input.uri);
  const [segment, mediaId, ...remaining] = parsed.pathname.slice(1).split('/');
  if (parsed.protocol !== `${input.scheme}:` || segment !== 'media' || !mediaId || remaining.length > 0 || parsed.search || parsed.hash) {
    throw input.notFound();
  }
  const { projectRef, media } = input.source(parsed.hostname);
  const projectRelativePath = media.path(mediaId);
  if (!projectRelativePath) throw input.notFound();
  const file = await readMediaGenerationReferenceProjectFile({
    projectName: projectRef.name,
    projectRelativePath,
    expectedProjectId: projectRef.id,
    homeDir: input.homeDir,
  });
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(file.absolutePath);
  } catch {
    throw input.notFound();
  }
  return { contents: [{ uri: input.uri, mimeType: file.mimeType, blob: bytes.toString('base64') }] };
}
