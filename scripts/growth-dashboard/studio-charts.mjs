import { eventSeries, sqlTable, STUDIO, trends } from './chart-queries.mjs';

// Only installs that turned on usage statistics send these events. "Installs"
// means distinct install IDs.
const INSTALLED = [{ key: 'result', value: ['installed'], operator: 'exact', type: 'event' }];
const FAILED = [{ key: 'result', value: ['failed'], operator: 'exact', type: 'event' }];
const STUDIO_SQL = `event IN ('studio_started', 'project_created', 'fdx_imported', 'sample_film_download_started',
  'sample_film_download_finished', 'sample_film_opened', 'generation_completed', 'heard_about', 'telemetry_opted_out')
  AND properties.surface = 'studio'`;

export const STUDIO_CHARTS = [
  {
    name: 'Active Studio installs (7 days)',
    description: 'Installs that started Studio in the last 7 days, compared with the 7 days before.',
    width: 4,
    height: 3,
    query: trends([eventSeries('studio_started', { math: 'dau', name: 'Installs' })], {
      dateFrom: '-7d', display: 'BoldNumber', properties: STUDIO, compare: true,
    }),
  },
  {
    name: 'Sample films downloaded (30 days)',
    description: 'Sample film downloads that finished in the last 30 days.',
    width: 4,
    height: 3,
    query: trends([eventSeries('sample_film_download_finished', { name: 'Downloads', properties: INSTALLED })], {
      display: 'BoldNumber', properties: STUDIO,
    }),
  },
  {
    name: 'Projects created (30 days)',
    description: 'New projects in the last 30 days. The sample film is not counted here.',
    width: 4,
    height: 3,
    query: trends([eventSeries('project_created', { name: 'Projects' })], {
      display: 'BoldNumber', properties: STUDIO,
    }),
  },
  {
    name: 'Studio installs sharing statistics',
    description: 'Installs that sent any usage statistics each week.',
    width: 6,
    query: sqlTable(`SELECT toStartOfWeek(timestamp) AS "Week", count(DISTINCT distinct_id) AS "Installs"
      FROM events
      WHERE ${STUDIO_SQL} AND timestamp > now() - INTERVAL 90 DAY
      GROUP BY "Week" ORDER BY "Week"`),
  },
  {
    name: 'Studio starts per week',
    description: 'How often Studio was started, and by how many installs.',
    width: 6,
    query: trends([
      eventSeries('studio_started', { name: 'Starts' }),
      eventSeries('studio_started', { math: 'dau', name: 'Installs' }),
    ], { interval: 'week', dateFrom: '-90d', properties: STUDIO }),
  },
  {
    name: 'Sample film path',
    description: 'Of installs in the last 30 days: how many started a sample film download, finished it, and opened the sample.',
    width: 6,
    query: trends([
      eventSeries('sample_film_download_started', { math: 'dau', name: 'Started a download' }),
      eventSeries('sample_film_download_finished', { math: 'dau', name: 'Finished the download', properties: INSTALLED }),
      eventSeries('sample_film_opened', { math: 'dau', name: 'Opened the sample' }),
    ], { display: 'ActionsTable', properties: STUDIO }),
  },
  {
    name: 'Sample download failures',
    description: 'Failed sample film downloads in the last 30 days, by Renku error code.',
    width: 6,
    query: trends([eventSeries('sample_film_download_finished', { name: 'Failures', properties: FAILED })], {
      display: 'ActionsTable', breakdown: { breakdown: 'error_code', breakdown_type: 'event' }, properties: STUDIO,
    }),
  },
  {
    name: 'Projects and screenplays',
    description: 'Projects created and FDX screenplays imported per week.',
    width: 6,
    query: trends([
      eventSeries('project_created', { name: 'Projects created' }),
      eventSeries('fdx_imported', { name: 'FDX screenplays imported' }),
    ], { interval: 'week', dateFrom: '-90d', display: 'ActionsBar', properties: STUDIO }),
  },
  {
    name: 'Generations by media kind',
    description: 'Generated images, videos and audio saved into projects per week.',
    width: 6,
    query: trends([eventSeries('generation_completed', { name: 'Generations' })], {
      interval: 'week', dateFrom: '-90d', display: 'ActionsBar',
      breakdown: { breakdown: 'media_kind', breakdown_type: 'event' }, properties: STUDIO,
    }),
  },
  {
    name: 'Where people heard about Renku',
    description: 'Answers from the first-run question, all time. The question is optional.',
    width: 6,
    query: trends([eventSeries('heard_about', { name: 'Answers' })], {
      dateFrom: 'all', display: 'ActionsBarValue',
      breakdown: { breakdown: 'answer', breakdown_type: 'event' }, properties: STUDIO,
    }),
  },
  {
    name: 'Studio opt-outs per week',
    description: 'Installs that turned usage statistics off.',
    width: 6,
    query: trends([eventSeries('telemetry_opted_out', { name: 'Opt-outs' })], {
      interval: 'week', dateFrom: '-90d', display: 'ActionsBar', properties: STUDIO,
    }),
  },
  {
    name: 'Studio versions in use',
    description: 'Installs that started Studio in the last 30 days, by Renku version.',
    width: 6,
    query: sqlTable(`SELECT properties.version AS "Version", count(DISTINCT distinct_id) AS "Installs"
      FROM events
      WHERE event = 'studio_started' AND properties.surface = 'studio' AND timestamp > now() - INTERVAL 30 DAY
      GROUP BY "Version" ORDER BY "Installs" DESC`),
  },
  {
    name: 'Studio systems',
    description: 'Installs that started Studio in the last 30 days, by operating system and chip.',
    width: 6,
    query: sqlTable(`SELECT properties.platform AS "System", properties.arch AS "Chip", count(DISTINCT distinct_id) AS "Installs"
      FROM events
      WHERE event = 'studio_started' AND properties.surface = 'studio' AND timestamp > now() - INTERVAL 30 DAY
      GROUP BY "System", "Chip" ORDER BY "Installs" DESC`),
  },
];
