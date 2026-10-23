const GHOST_BEATS = [
  ['30%', '85%', '60%'],
  ['26%', '78%', '66%'],
  ['34%', '90%', '48%'],
  ['28%', '82%', '58%'],
  ['32%', '74%', '64%'],
  ['24%', '88%', '52%'],
];

/** Faint beat cards in the real grid, drawn behind the Beats empty state. Decorative only. */
export function SceneBeatsPreview() {
  return (
    <div className='absolute inset-0 grid grid-cols-3 content-start gap-[18px] px-8 py-7'>
      {GHOST_BEATS.map((lineWidths, index) => (
        <div key={index} className='flex flex-col gap-2.5 rounded-[10px] bg-muted/60 p-2.5'>
          <div className='aspect-video rounded-md bg-muted' />
          {lineWidths.map((width, lineIndex) => (
            <div key={lineIndex} className='h-[7px] rounded bg-muted' style={{ width }} />
          ))}
        </div>
      ))}
    </div>
  );
}
