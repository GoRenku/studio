// Formats a YYYY-MM-DD date as "15 October 2026", independent of the build machine's time zone.
export function formatArticleDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
