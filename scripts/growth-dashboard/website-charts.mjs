import { eventSeries, MATINEE, trends, WEBSITE } from './chart-queries.mjs';

const CHANNEL = { breakdown: '$channel_type', breakdown_type: 'session' };

export const WEBSITE_CHARTS = [
  {
    name: 'Website visits by channel',
    description: 'Visits to gorenku.com per week, split by where visitors came from.',
    width: 6,
    query: trends([eventSeries('$pageview', { math: 'unique_session', name: 'Visits' })], {
      interval: 'week', dateFrom: '-90d', display: 'ActionsBar', breakdown: CHANNEL, properties: WEBSITE,
    }),
  },
  {
    name: 'Website install path',
    description: 'Of the visits in the last 30 days: how many opened /download, and how many copied an install command. Visitors who chose Yes only.',
    width: 6,
    query: trends([
      eventSeries('$pageview', { math: 'unique_session', name: 'Visited the website' }),
      eventSeries('$pageview', {
        math: 'unique_session',
        name: 'Opened /download',
        properties: [{ key: '$pathname', value: '^/download/?$', operator: 'regex', type: 'event' }],
      }),
      eventSeries('install_command_copied', { math: 'unique_session', name: 'Copied an install command' }),
    ], {
      display: 'ActionsTable',
      properties: [...WEBSITE, { key: '$cookieless_mode', operator: 'is_not_set', type: 'event' }],
    }),
  },
  {
    name: 'Website actions per week',
    description: 'Clicks to the download page and GitHub, and install commands copied. Visitors who chose Yes only.',
    width: 6,
    query: trends([
      eventSeries('download_clicked', { name: 'Download page clicks' }),
      eventSeries('github_link_clicked', { name: 'GitHub link clicks' }),
      eventSeries('install_command_copied', { name: 'Install commands copied' }),
      eventSeries('skills_install_copied', { name: 'Skills commands copied' }),
    ], { interval: 'week', dateFrom: '-90d', properties: WEBSITE }),
  },
  {
    name: 'Top website pages',
    description: 'Visits per page in the last 30 days.',
    width: 6,
    query: trends([eventSeries('$pageview', { math: 'unique_session', name: 'Visits' })], {
      display: 'ActionsTable', breakdown: { breakdown: '$pathname', breakdown_type: 'event' }, properties: WEBSITE,
    }),
  },
  {
    name: 'Tutorials and videos',
    description: 'Tutorials opened and videos started in the last 30 days. Visitors who chose Yes only.',
    width: 6,
    query: trends([
      eventSeries('tutorial_viewed', { name: 'Tutorial opened' }),
      eventSeries('video_played', { name: 'Video started' }),
    ], { display: 'ActionsTable', properties: WEBSITE }),
  },
  {
    name: 'Latent Matinee referrals',
    description: 'Visits to gorenku.com per week that came from Latent Matinee.',
    width: 6,
    query: trends([eventSeries('$pageview', { math: 'unique_session', name: 'Visits from Latent Matinee' })], {
      interval: 'week',
      dateFrom: '-90d',
      properties: {
        type: 'AND',
        values: [
          { type: 'AND', values: WEBSITE },
          { type: 'OR', values: [
            { key: 'utm_source', value: ['latentmatinee'], operator: 'exact', type: 'event' },
            { key: '$referring_domain', value: ['latentmatinee.com'], operator: 'exact', type: 'event' },
          ] },
        ],
      },
    }),
  },
];

export const MATINEE_CHARTS = [
  {
    name: 'Latent Matinee visits by channel',
    description: 'Visits to latentmatinee.com per week, split by where visitors came from.',
    width: 8,
    query: trends([eventSeries('$pageview', { math: 'unique_session', name: 'Visits' })], {
      interval: 'week', dateFrom: '-90d', display: 'ActionsBar', breakdown: CHANNEL, properties: MATINEE,
    }),
  },
  {
    name: 'Newsletter sign-ups',
    description: 'Latent Matinee newsletter forms submitted per week.',
    width: 4,
    query: trends([eventSeries('newsletter_signup_submitted', { name: 'Sign-ups' })], {
      interval: 'week', dateFrom: '-90d', display: 'ActionsBar', properties: MATINEE,
    }),
  },
];
