export function humanizeReferenceName(name: string): string {
  return name
    .replaceAll('_', '-')
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
