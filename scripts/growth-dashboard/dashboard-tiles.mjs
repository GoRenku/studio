import { DOWNLOAD_CHARTS } from './download-charts.mjs';
import { GITHUB_CHARTS } from './github-charts.mjs';
import { OVERVIEW_CHARTS } from './overview-charts.mjs';
import { MATINEE_CHARTS, WEBSITE_CHARTS } from './website-charts.mjs';

export const DASHBOARD_NAME = 'Renku growth';
export const DASHBOARD_DESCRIPTION = 'Website visits, GitHub activity and Renku downloads in one place.';

const GRID_COLUMNS = 12;
const CHART_HEIGHT = 5;
const HEADING_HEIGHT = 1;

const SECTIONS = [
  {
    heading: '## At a glance',
    note: 'GitHub and download numbers come from the daily growth report and are complete up to yesterday. Website clicks, copies and video plays count only visitors who chose Yes in the analytics banner.',
    charts: OVERVIEW_CHARTS,
  },
  { heading: '## gorenku.com', charts: WEBSITE_CHARTS },
  {
    heading: '## Downloads',
    note: 'Requests to downloads.gorenku.com. The free Cloudflare plan cannot tell bots from people, so these include scripts and crawlers.',
    charts: DOWNLOAD_CHARTS,
  },
  { heading: '## GitHub', charts: GITHUB_CHARTS },
  { heading: '## Latent Matinee', charts: MATINEE_CHARTS },
];

/** Every tile in dashboard order, each with its grid position. */
export function dashboardTiles() {
  const tiles = [];
  let y = 0;
  for (const section of SECTIONS) {
    const body = section.note ? `${section.heading}\n\n${section.note}` : section.heading;
    const headingHeight = section.note ? HEADING_HEIGHT + 1 : HEADING_HEIGHT;
    tiles.push({ kind: 'text', heading: section.heading, body, layout: { x: 0, y, w: GRID_COLUMNS, h: headingHeight } });
    y += headingHeight;
    y = placeCharts(section.charts, y, tiles);
  }
  return tiles;
}

function placeCharts(charts, top, tiles) {
  let x = 0;
  let y = top;
  let rowHeight = 0;
  for (const chart of charts) {
    const h = chart.height ?? CHART_HEIGHT;
    if (x + chart.width > GRID_COLUMNS) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }
    tiles.push({ kind: 'insight', chart, layout: { x, y, w: chart.width, h } });
    x += chart.width;
    rowHeight = Math.max(rowHeight, h);
  }
  return y + rowHeight;
}
