import { classifyDownloadPath } from './download-paths.mjs';
import { growthEventUuid } from './event-identity.mjs';

const DOWNLOAD_SOURCE = 'downloads.gorenku.com';

const DAY_SERIES = [
  { event: 'github_views_day', series: 'views', countProperty: 'views', uniquesProperty: 'unique_visitors' },
  { event: 'github_clones_day', series: 'clones', countProperty: 'clones', uniquesProperty: 'unique_cloners' },
];

const REPOSITORY_BUILDERS = [repositoryTotalsEvents, starWeekEvents, daySeriesEvents, topReferrerEvents, topPathEvents];

/**
 * @param {{ repositories: import('./github-api.mjs').RepositoryGrowth[],
 *   downloadDays: import('./cloudflare-downloads.mjs').DownloadDay[], reportDate: string }} readings
 */
export function buildGrowthEvents({ repositories, downloadDays, reportDate }) {
  const repositoryEvents = repositories.flatMap((growth) =>
    REPOSITORY_BUILDERS.flatMap((builder) => builder(growth, reportDate))
  );
  const downloads = downloadEvents(downloadDays, reportDate);
  return { events: [...repositoryEvents, ...downloads.events], skippedDownloadRequests: downloads.skippedRequests };
}

function growthEvent({ event, source, key, timestamp, reportDate, properties }) {
  return {
    event,
    distinct_id: source,
    uuid: growthEventUuid([event, ...key]),
    timestamp,
    properties: { ...properties, report_date: reportDate, $process_person_profile: false, $geoip_disable: true },
  };
}

function repositoryEvent(growth, reportDate, { event, key, timestamp, properties }) {
  return growthEvent({
    event,
    source: `github:${growth.repository}`,
    key: [growth.repository, ...key],
    timestamp,
    reportDate,
    properties: { repository: growth.repository, ...properties },
  });
}

function repositoryTotalsEvents(growth, reportDate) {
  return [repositoryEvent(growth, reportDate, {
    event: 'github_repository_totals',
    key: [reportDate],
    timestamp: startOfDay(reportDate),
    properties: {
      stars_total: growth.starsTotal,
      views_14d: growth.views.count,
      unique_visitors_14d: growth.views.uniques,
      clones_14d: growth.clones.count,
      unique_cloners_14d: growth.clones.uniques,
    },
  })];
}

function starWeekEvents(growth, reportDate) {
  let starsAtWeekEnd = 0;
  return [...growth.starWeeks].sort((left, right) => left.week - right.week).map(({ week, newStars }) => {
    starsAtWeekEnd += newStars;
    const timestamp = new Date(week * 1000).toISOString();
    return repositoryEvent(growth, reportDate, {
      event: 'github_star_week',
      key: [week],
      timestamp,
      properties: { week_start: timestamp.slice(0, 10), new_stars: newStars, stars_at_week_end: starsAtWeekEnd },
    });
  });
}

function daySeriesEvents(growth, reportDate) {
  return DAY_SERIES.flatMap(({ event, series, countProperty, uniquesProperty }) =>
    finishedDays(growth[series].days, reportDate).map(({ day, count, uniques }) =>
      repositoryEvent(growth, reportDate, {
        event,
        key: [day],
        timestamp: startOfDay(day),
        properties: { day, [countProperty]: count, [uniquesProperty]: uniques },
      })
    )
  );
}

function topReferrerEvents(growth, reportDate) {
  return growth.referrers.map(({ referrer, count, uniques }) => repositoryEvent(growth, reportDate, {
    event: 'github_top_referrer',
    key: [reportDate, referrer],
    timestamp: startOfDay(reportDate),
    properties: { referrer, views_14d: count, unique_visitors_14d: uniques },
  }));
}

function topPathEvents(growth, reportDate) {
  return growth.paths.map(({ path, title, count, uniques }) => repositoryEvent(growth, reportDate, {
    event: 'github_top_path',
    key: [reportDate, path],
    timestamp: startOfDay(reportDate),
    properties: { path, title, views_14d: count, unique_visitors_14d: uniques },
  }));
}

function downloadEvents(downloadDays, reportDate) {
  const events = [];
  let skippedRequests = 0;
  for (const { day, requests } of finishedDays(downloadDays, reportDate)) {
    for (const { path, country, count } of requests) {
      const download = classifyDownloadPath(path);
      if (!download) {
        skippedRequests += count;
        continue;
      }
      events.push(growthEvent({
        event: 'download_requests_day',
        source: `downloads:${DOWNLOAD_SOURCE}`,
        key: [DOWNLOAD_SOURCE, day, path, country],
        timestamp: startOfDay(day),
        reportDate,
        properties: { day, path, ...download, country, requests: count },
      }));
    }
  }
  return { events, skippedRequests };
}

function finishedDays(days, reportDate) {
  return days.filter(({ day }) => day < reportDate);
}

function startOfDay(day) {
  return `${day}T00:00:00.000Z`;
}
