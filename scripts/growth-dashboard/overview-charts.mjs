import { DOWNLOADS_PER_KEY, eventSeries, sqlNumber, trends, WEBSITE } from './chart-queries.mjs';

const LAST_7_FINISHED_DAYS = `day >= toString(today() - 7) AND day < toString(today())`;

export const OVERVIEW_CHARTS = [
  {
    name: 'GitHub stars',
    description: 'Stars on GoRenku/studio and GoRenku/studio-skills together, from the latest report.',
    width: 3,
    height: 3,
    query: sqlNumber(`SELECT sum(stars) AS "Stars" FROM (
      SELECT properties.repository AS repository, argMax(toFloat(properties.stars_total), properties.report_date) AS stars
      FROM events WHERE event = 'github_repository_totals' AND timestamp > now() - INTERVAL 30 DAY
      GROUP BY repository
    )`),
  },
  {
    name: 'Website visits (7 days)',
    description: 'Visits to gorenku.com, compared with the 7 days before.',
    width: 3,
    height: 3,
    query: trends([eventSeries('$pageview', { math: 'unique_session', name: 'Visits' })], {
      dateFrom: '-7d', display: 'BoldNumber', properties: WEBSITE, compare: true,
    }),
  },
  {
    name: 'Installer downloads (7 days)',
    description: 'install.sh and install.ps1 downloads in the last 7 finished days: roughly new installs.',
    width: 3,
    height: 3,
    query: sqlNumber(`SELECT sum(requests) AS "Installer downloads" FROM ${DOWNLOADS_PER_KEY}
      WHERE kind IN ('installer_macos', 'installer_windows') AND ${LAST_7_FINISHED_DAYS}`),
  },
  {
    name: 'Update checks per day',
    description: 'Average daily release.json requests over the last 7 finished days. Divide by about four for running copies of Studio.',
    width: 3,
    height: 3,
    query: sqlNumber(`SELECT round(sum(requests) / 7, 1) AS "Update checks per day" FROM ${DOWNLOADS_PER_KEY}
      WHERE kind = 'release_manifest' AND ${LAST_7_FINISHED_DAYS}`),
  },
];
