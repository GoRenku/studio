import { sqlChart, sqlTable } from './chart-queries.mjs';

const STUDIO = 'GoRenku/studio';
const SKILLS = 'GoRenku/studio-skills';

// One value per repository and bucket (the highest stored copy), with one
// column per repository so the chart draws one line each.
function perRepository({ event, bucket, value, since }) {
  return `SELECT ${bucket},
    sumIf(reading, repository = '${STUDIO}') AS "studio",
    sumIf(reading, repository = '${SKILLS}') AS "studio-skills"
  FROM (
    SELECT properties.${bucket} AS ${bucket}, properties.repository AS repository,
      max(toFloat(properties.${value})) AS reading
    FROM events
    WHERE event = '${event}' AND properties.${bucket} >= toString(today() - ${since})
    GROUP BY ${bucket}, repository
  )
  GROUP BY ${bucket}
  ORDER BY ${bucket}`;
}

function latestReport(event) {
  return `event = '${event}'
    AND properties.report_date = (SELECT max(properties.report_date) FROM events WHERE event = '${event}')`;
}

const FOURTEEN_DAY_COLUMNS = `max(toFloat(properties.views_14d)) AS "Views (14 days)",
    max(toFloat(properties.unique_visitors_14d)) AS "Unique visitors (14 days)"`;

const TOP_REFERRERS = `SELECT properties.repository AS "Repository", properties.referrer AS "Referrer",
    ${FOURTEEN_DAY_COLUMNS}
  FROM events
  WHERE ${latestReport('github_top_referrer')}
  GROUP BY "Repository", "Referrer"
  ORDER BY "Views (14 days)" DESC`;

// Page paths already start with the repository, so no repository column.
const TOP_PAGES = `SELECT properties.path AS "Page", ${FOURTEEN_DAY_COLUMNS}
  FROM events
  WHERE ${latestReport('github_top_path')}
  GROUP BY "Page"
  ORDER BY "Views (14 days)" DESC`;

const REPOSITORY_LINES = { x: 'day', y: ['studio', 'studio-skills'] };

export const GITHUB_CHARTS = [
  {
    name: 'GitHub stars over time',
    description: 'Stars at the end of each week, per repository.',
    width: 6,
    query: sqlChart(perRepository({ event: 'github_star_week', bucket: 'week_start', value: 'stars_at_week_end', since: 365 }), {
      x: 'week_start', y: ['studio', 'studio-skills'],
    }),
  },
  {
    name: 'GitHub stars gained per week',
    description: 'New stars each week, per repository (unstars are already taken off).',
    width: 6,
    query: sqlChart(perRepository({ event: 'github_star_week', bucket: 'week_start', value: 'new_stars', since: 365 }), {
      x: 'week_start', y: ['studio', 'studio-skills'], display: 'ActionsBar',
    }),
  },
  {
    name: 'GitHub page views per day',
    description: 'Views of each repository on github.com per day.',
    width: 6,
    query: sqlChart(perRepository({ event: 'github_views_day', bucket: 'day', value: 'views', since: 90 }), REPOSITORY_LINES),
  },
  {
    name: 'GitHub unique visitors per day',
    description: 'Different people viewing each repository per day.',
    width: 6,
    query: sqlChart(perRepository({ event: 'github_views_day', bucket: 'day', value: 'unique_visitors', since: 90 }), REPOSITORY_LINES),
  },
  {
    name: 'GitHub clones per day',
    description: 'Mostly installs and renku update fetching plugins, so this counts machines, not people.',
    width: 6,
    query: sqlChart(perRepository({ event: 'github_clones_day', bucket: 'day', value: 'clones', since: 90 }), REPOSITORY_LINES),
  },
  {
    name: 'GitHub unique cloners per day',
    description: 'Different machines cloning each repository per day.',
    width: 6,
    query: sqlChart(perRepository({ event: 'github_clones_day', bucket: 'day', value: 'unique_cloners', since: 90 }), REPOSITORY_LINES),
  },
  {
    name: 'GitHub top referrers',
    description: 'Sites that sent visitors to each repository over the last 14 days (latest report).',
    width: 6,
    query: sqlTable(TOP_REFERRERS),
  },
  {
    name: 'GitHub top pages',
    description: 'Most viewed pages of each repository over the last 14 days (latest report).',
    width: 6,
    query: sqlTable(TOP_PAGES),
  },
];
