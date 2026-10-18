import { DOWNLOADS_PER_KEY, sqlChart, sqlTable } from './chart-queries.mjs';

const LAST_90_DAYS = `day >= toString(today() - 90)`;
const LAST_30_DAYS = `day >= toString(today() - 30)`;

export const DOWNLOAD_CHARTS = [
  {
    name: 'Installer downloads per day',
    description: 'Downloads of install.sh (macOS) and install.ps1 (Windows): roughly new installs. renku update does not download these. Includes bots.',
    width: 6,
    query: sqlChart(`SELECT day,
        sumIf(requests, kind = 'installer_macos') AS "macOS",
        sumIf(requests, kind = 'installer_windows') AS "Windows"
      FROM ${DOWNLOADS_PER_KEY}
      WHERE ${LAST_90_DAYS}
      GROUP BY day ORDER BY day`, { x: 'day', y: ['macOS', 'Windows'], display: 'ActionsBar' }),
  },
  {
    name: 'Studio update checks per day',
    description: 'Requests for release.json. Every running Studio asks about four times a day, and every install asks once, so this follows how many copies are running.',
    width: 6,
    query: sqlChart(`SELECT day, sum(requests) AS "Update checks"
      FROM ${DOWNLOADS_PER_KEY}
      WHERE kind = 'release_manifest' AND ${LAST_90_DAYS}
      GROUP BY day ORDER BY day`, { x: 'day', y: ['Update checks'] }),
  },
  {
    name: 'Release downloads per day',
    description: 'Release archives downloaded per day, by platform. These are installs and updates together.',
    width: 6,
    query: sqlChart(`SELECT day,
        sumIf(requests, target LIKE 'darwin-%') AS "macOS",
        sumIf(requests, target LIKE 'win32-%') AS "Windows"
      FROM ${DOWNLOADS_PER_KEY}
      WHERE kind = 'release_archive' AND ${LAST_90_DAYS}
      GROUP BY day ORDER BY day`, { x: 'day', y: ['macOS', 'Windows'], display: 'ActionsBar' }),
  },
  {
    name: 'Release downloads by version',
    description: 'Release archives downloaded in the last 30 days, by version and platform.',
    width: 6,
    query: sqlTable(`SELECT coalesce(version, concat(channel, ' channel')) AS "Version", target AS "Platform",
        sum(requests) AS "Downloads"
      FROM ${DOWNLOADS_PER_KEY}
      WHERE kind = 'release_archive' AND ${LAST_30_DAYS}
      GROUP BY "Version", "Platform" ORDER BY "Downloads" DESC`),
  },
  {
    name: 'Downloads by country',
    description: 'Last 30 days. Country as Cloudflare works it out from the network address.',
    width: 12,
    query: sqlTable(`SELECT country AS "Country",
        sumIf(requests, kind IN ('installer_macos', 'installer_windows')) AS "Installer downloads",
        sumIf(requests, kind = 'release_archive') AS "Release downloads",
        sumIf(requests, kind = 'release_manifest') AS "Update checks"
      FROM ${DOWNLOADS_PER_KEY}
      WHERE ${LAST_30_DAYS}
      GROUP BY "Country" ORDER BY "Installer downloads" DESC, "Release downloads" DESC`),
  },
];
