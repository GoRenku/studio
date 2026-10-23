const ACTS = [
  { title: 'Act I', role: 'Setup', span: 3 },
  { title: 'Act II', role: 'Confrontation', span: 4 },
  { title: 'Act III', role: 'Resolution', span: 3 },
];

/** A faint outline of the Story Arc chart, drawn behind its empty state. Decorative only. */
export function StoryArcPreview({ sceneCount }: { sceneCount: number }) {
  return (
    <div className='absolute inset-0'>
      <div className='absolute inset-y-0 right-6 left-14 grid grid-cols-[3fr_4fr_3fr] gap-1.5'>
        {ACTS.map((act, index) => (
          <div
            key={act.title}
            className={
              index === 1
                ? 'flex flex-col items-center gap-1 pt-3'
                : 'flex flex-col items-center gap-1 bg-muted/40 pt-3'
            }
          >
            <span className='text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground'>
              {act.title}
            </span>
            <span className='text-[10px] uppercase tracking-[0.1em] text-muted-foreground'>
              {act.role}
            </span>
          </div>
        ))}
      </div>
      <svg
        viewBox='0 0 1000 420'
        preserveAspectRatio='none'
        fill='none'
        className='absolute top-24 right-6 left-14 h-[60%] w-[calc(100%-5rem)] text-muted-foreground'
      >
        <path
          d='M0 230 C 80 160, 140 260, 230 260 S 380 210, 480 220 S 620 120, 700 150 S 860 60, 1000 40'
          stroke='currentColor'
          strokeWidth='3'
          strokeDasharray='2 10'
          strokeLinecap='round'
        />
        <path
          d='M0 330 C 160 320, 300 280, 480 240 S 800 150, 1000 70'
          stroke='currentColor'
          strokeOpacity='0.5'
          strokeWidth='2'
          strokeDasharray='6 8'
        />
      </svg>
      <div className='absolute right-6 bottom-6 left-14 flex gap-1'>
        {Array.from({ length: Math.max(sceneCount, 1) }, (_, index) => (
          <span key={index} className='h-[18px] flex-1 rounded-[3px] bg-muted' />
        ))}
      </div>
    </div>
  );
}
