import { GrowthReportError, networkFailureText } from './errors.mjs';
import { replyShapeProblems } from './reply-shape.mjs';

const CLOUDFLARE_GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const DOWNLOAD_HOST = 'downloads.gorenku.com';
const ROW_LIMIT = 10000;
const ACCESS_STATUSES = new Set([401, 403]);
const ACCESS_ERROR_PATTERN = /not authori[sz]ed|unauthori[sz]ed|permission|forbidden|authentication/i;

const DOWNLOAD_QUERY = `query DownloadDay($zoneTag: string, $day: Date, $host: string, $limit: uint64) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        limit: $limit
        filter: {
          date: $day
          clientRequestHTTPHost: $host
          requestSource: "eyeball"
          clientRequestHTTPMethodName: "GET"
          edgeResponseStatus: 200
        }
      ) {
        count
        dimensions { clientRequestPath clientCountryName }
      }
    }
  }
}`;

const REPLY_SHAPE = {
  data: {
    viewer: {
      zones: [{ httpRequestsAdaptiveGroups: [{ count: 'number', dimensions: { clientRequestPath: 'string', clientCountryName: 'string' } }] }],
    },
  },
};

/**
 * @typedef {{ day: string, requests: { path: string, country: string, count: number }[] }} DownloadDay
 * @returns {Promise<DownloadDay>}
 */
export async function readDownloadDay(day, { token, zoneId, fetch }) {
  const response = await requestCloudflare(day, { token, zoneId, fetch });
  // Cloudflare reports some failures, such as a rejected token (HTTP 400),
  // only through the errors list, so it is read before the status.
  const reply = await response.json().catch(() => null);
  if (ACCESS_STATUSES.has(response.status)) {
    throw cloudflareAccessError(day, `answered HTTP ${response.status}`);
  }
  if (Array.isArray(reply?.errors) && reply.errors.length > 0) {
    throw cloudflareQueryError(day, reply.errors);
  }
  if (!response.ok) {
    throw cloudflareStatusError(day, response.status);
  }
  const groups = downloadGroups(day, reply);
  return {
    day,
    requests: groups.map(({ count, dimensions }) => ({
      path: dimensions.clientRequestPath,
      country: dimensions.clientCountryName,
      count,
    })),
  };
}

function downloadGroups(day, reply) {
  const zones = reply?.data?.viewer?.zones;
  if (Array.isArray(zones) && zones.length === 0) {
    throw cloudflareAccessError(day, 'returned no zone');
  }
  const problems = replyShapeProblems(reply, REPLY_SHAPE);
  if (problems.length > 0) {
    throw new GrowthReportError(
      'GROWTH005',
      `Cloudflare download reply for ${day} has an unexpected shape: ${problems.join('; ')}.`,
      'Inspect the httpRequestsAdaptiveGroups query in cloudflare-downloads.mjs; the field names may have changed.'
    );
  }
  const groups = zones[0].httpRequestsAdaptiveGroups;
  if (groups.length >= ROW_LIMIT) {
    throw new GrowthReportError(
      'GROWTH008',
      `Cloudflare download reply for ${day} reached the ${ROW_LIMIT}-row limit, so counts would be incomplete.`,
      'Split the download query into smaller groups before sending these counts.'
    );
  }
  return groups;
}

async function requestCloudflare(day, { token, zoneId, fetch }) {
  try {
    return await fetch(CLOUDFLARE_GRAPHQL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: DOWNLOAD_QUERY,
        variables: { zoneTag: zoneId, day, host: DOWNLOAD_HOST, limit: ROW_LIMIT },
      }),
    });
  } catch (error) {
    throw new GrowthReportError(
      'GROWTH008',
      `Cloudflare download request for ${day} failed: ${networkFailureText(error)}.`,
      'Check the network connection. The next run re-sends the whole window.'
    );
  }
}

function cloudflareStatusError(day, status) {
  return new GrowthReportError(
    'GROWTH008',
    `Cloudflare download query for ${day} answered HTTP ${status}.`,
    'Retry later. The next run re-sends the whole window.'
  );
}

function cloudflareQueryError(day, errors) {
  const messages = errors.map((error) => String(error?.message ?? 'unknown error')).join('; ').slice(0, 300);
  if (ACCESS_ERROR_PATTERN.test(messages)) {
    return cloudflareAccessError(day, `refused the query: ${messages}`);
  }
  return new GrowthReportError(
    'GROWTH008',
    `Cloudflare download query for ${day} failed: ${messages}.`,
    'Check that the day is inside the plan limits in docs/operations/growth-report.md. The next run re-sends the whole window.'
  );
}

function cloudflareAccessError(day, detail) {
  return new GrowthReportError(
    'GROWTH007',
    `Cloudflare ${detail} for the download query on ${day}.`,
    'Give CLOUDFLARE_ANALYTICS_TOKEN "Zone → Analytics → Read" on gorenku.com, check CLOUDFLARE_ZONE_ID, and check that the token has not expired.'
  );
}
