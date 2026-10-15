const studioRepository = 'GoRenku/studio';

// The header shows the count only once it is at least this number.
export const studioStarCountShownFrom = 20;

function buildStoppedError(reason: string): Error {
  return new Error(
    `Website build stopped: could not read the GitHub star count for ${studioRepository} (${reason}). Try the build again later.`,
  );
}

async function readStudioStarCount(): Promise<number> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${studioRepository}`, {
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

  const count = body && typeof body === 'object' && 'stargazers_count' in body ? body.stargazers_count : undefined;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw buildStoppedError(`HTTP ${response.status}: the response has no whole, non-negative stargazers_count`);
  }
  return count;
}

// Read once per production build; `astro dev` asks GitHub for nothing.
export const studioStarCount: number | undefined = import.meta.env.DEV ? undefined : await readStudioStarCount();
