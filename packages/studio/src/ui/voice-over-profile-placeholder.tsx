export function VoiceOverProfilePlaceholder() {
  const barHeights = [24, 44, 68, 38, 82, 54, 30, 62, 46];
  return (
    <span
      aria-hidden='true'
      data-testid='voice-over-profile-placeholder'
      className='relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_36%,rgba(217,177,102,0.18),transparent_34%),linear-gradient(145deg,rgba(28,31,32,0.96),rgba(12,13,14,1))]'
    >
      <span className='absolute inset-x-0 top-1/2 h-px bg-white/8' />
      <span className='flex h-[31%] w-[51%] items-center justify-center gap-[5%] rounded-full border border-white/8 bg-black/18 px-[10%] shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-sm'>
        {barHeights.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className='w-[3.75%] rounded-full bg-[linear-gradient(180deg,rgba(244,213,151,0.95),rgba(113,156,171,0.72))] shadow-[0_0_14px_rgba(217,177,102,0.2)]'
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
    </span>
  );
}
