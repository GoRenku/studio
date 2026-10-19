// Small builders for the PostHog query shapes the dashboard uses.

export const WEBSITE = [
  { key: '$host', value: ['gorenku.com'], operator: 'exact', type: 'event' },
  { key: 'surface', value: ['website'], operator: 'exact', type: 'event' },
];

export const MATINEE = [
  { key: '$host', value: ['latentmatinee.com'], operator: 'exact', type: 'event' },
  { key: 'surface', value: ['matinee'], operator: 'exact', type: 'event' },
];

export const STUDIO = [
  { key: 'surface', value: ['studio'], operator: 'exact', type: 'event' },
];

export function eventSeries(event, { math = 'total', mathProperty, name, properties = [] } = {}) {
  return {
    kind: 'EventsNode',
    event,
    name: event,
    custom_name: name,
    math,
    ...(mathProperty ? { math_property: mathProperty } : {}),
    properties,
  };
}

export function trends(series, { interval = 'day', dateFrom = '-30d', display = 'ActionsLineGraph', breakdown, properties = [], compare = false } = {}) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'TrendsQuery',
      series,
      interval,
      dateRange: { date_from: dateFrom },
      properties,
      ...(breakdown ? { breakdownFilter: breakdown } : {}),
      ...(compare ? { compareFilter: { compare: true } } : {}),
      trendsFilter: { display, showLegend: true },
    },
  };
}

export function sqlTable(query) {
  return { kind: 'DataVisualizationNode', source: { kind: 'HogQLQuery', query }, display: 'ActionsTable' };
}

export function sqlNumber(query) {
  return { kind: 'DataVisualizationNode', source: { kind: 'HogQLQuery', query }, display: 'BoldNumber' };
}

export function sqlChart(query, { x, y, display = 'ActionsLineGraph' }) {
  return {
    kind: 'DataVisualizationNode',
    source: { kind: 'HogQLQuery', query },
    display,
    chartSettings: { xAxis: { column: x }, yAxis: y.map((column) => ({ column })), showLegend: true },
  };
}

// Growth report events can be stored more than once. Every reading is first
// reduced to its highest value per key, then added up (see
// docs/operations/growth-report.md, "Counting rule for charts").
export const DOWNLOADS_PER_KEY = `(
  SELECT properties.day AS day, properties.path AS path, properties.country AS country,
    any(properties.download_kind) AS kind, any(properties.release_version) AS version,
    any(properties.release_channel) AS channel, any(properties.release_target) AS target,
    max(toFloat(properties.requests)) AS requests
  FROM events
  WHERE event = 'download_requests_day'
  GROUP BY day, path, country
)`;
