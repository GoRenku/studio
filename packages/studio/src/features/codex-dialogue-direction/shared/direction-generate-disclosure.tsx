/** States what one Generate click authorizes, beside the Generate button. */
export function DirectionGenerateDisclosure(input: { children: string }) {
  return <p className='m-0 max-w-[44em] text-[11px] leading-snug text-[var(--dd-muted-fg)]'>{input.children}</p>;
}
