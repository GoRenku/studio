// App-derived shot label from shot array order, consistent with plan 0032 and
// the resource layer's Act-overview labels.
export function shotLabel(index: number): string {
  return `Shot ${index + 1}`;
}
