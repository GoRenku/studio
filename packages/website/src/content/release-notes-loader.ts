import type { Loader } from 'astro/loaders';

const studioRepository = 'GoRenku/studio';

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  body: string | null;
}

function buildStoppedError(reason: string): Error {
  return new Error(
    `Website build stopped: could not read the GitHub Releases for ${studioRepository} (${reason}). Try the build again later.`,
  );
}

async function readStudioReleases(): Promise<GitHubRelease[]> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${studioRepository}/releases?per_page=100`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'gorenku-website-build',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw buildStoppedError(`network error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body ? String(body.message) : response.statusText;
    throw buildStoppedError(`HTTP ${response.status}: ${message}`);
  }
  if (!Array.isArray(body)) {
    throw buildStoppedError(`HTTP ${response.status}: the response is not a list of releases`);
  }
  return body as GitHubRelease[];
}

// GitHub adds a generator comment and a "Full Changelog" compare link to every release.
// A release has notes only when something else is written in its body.
function writtenNotes(body: string | null): string | undefined {
  const notes = (body ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\*\*Full changelog\*\*:.*$/gim, '')
    .trim();
  return notes.length > 0 ? notes : undefined;
}

export function releaseNotesLoader(): Loader {
  return {
    name: 'github-release-notes',
    load: async ({ store, parseData, renderMarkdown }) => {
      const releases = await readStudioReleases();
      store.clear();
      for (const release of releases) {
        const notes = writtenNotes(release.body);
        if (release.draft || !release.published_at || !notes) continue;
        const version = release.tag_name.replace(/^v/, '');
        const data = await parseData({
          id: version,
          data: {
            version,
            date: release.published_at.slice(0, 10),
            url: release.html_url,
            prerelease: release.prerelease,
          },
        });
        store.set({ id: version, data, rendered: await renderMarkdown(notes) });
      }
    },
  };
}
