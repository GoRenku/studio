// App-derived beat label from beat array order, consistent with plan 0032 and
// the resource layer's Act-overview labels.
export function beatLabel(index: number): string {
  return `Beat ${index + 1}`;
}
