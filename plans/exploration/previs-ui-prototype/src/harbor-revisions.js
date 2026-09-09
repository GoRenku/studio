// Presentation fixtures for this UX exploration; no project database is read.
// Cue copy demonstrates the interface, not a transcription of the rendered video.
export const subjects = [
  { key: 'mara', label: 'Mara', color: '#ed8176' },
  { key: 'urban', label: 'Urban', color: '#e8bd52' },
  { key: 'guard', label: 'Guard', color: '#78aade' },
  { key: 'dockworker', label: 'Dockworker', color: '#bb99dd' },
];

export const revisions = [
  {
    number: 1,
    src: '/media/previs-v001.mp4',
    cues: [
      { start: 6, end: 8, subject: 'mara', text: 'Mara speaks.' },
      { start: 8, end: 11, subject: 'urban', text: 'Turns toward the water.' },
      { start: 12, end: 14.5, subject: 'dockworker', text: 'Crosses behind them.' },
    ],
  },
  {
    number: 2,
    src: '/media/previs-v002.mp4',
    cues: [
      { start: 7, end: 8.85, subject: 'mara', text: 'Mara speaks.' },
      { start: 8.85, end: 11.5, subject: 'urban', text: 'Turns toward the water.' },
      { start: 12, end: 14.5, subject: 'dockworker', text: 'Crosses behind them.' },
    ],
  },
  {
    number: 3,
    src: '/media/previs-v003.mp4',
    generation: '/media/harbor-generation.mp4',
    cues: [
      { start: 8, end: 11, subject: 'mara', text: 'Mara speaks.' },
      { start: 11, end: 13, subject: 'urban', text: 'Turns toward the water.' },
      { start: 14, end: 16.5, subject: 'dockworker', text: 'Crosses behind them.' },
    ],
  },
];

export const description = [
  '## Blocking & camera',
  'Follow Mara and Urban along the quay in a **tracking two-shot**. Hold on the exchange before Urban turns toward the water.',
  'Keep Mara in the foreground during the pause. Let the dockworkers continue behind them without interrupting the exchange.',
  'The harbor should feel alive and lived-in — traders, guards, and workers going about their business as the conversation unfolds.',
  '## Movement & timing',
  'Begin at **walking pace** with enough room to read both figures and the water beyond. Follow their arrival without cutting away from the geography of the quay.',
  'Mara reaches the guard first. Urban settles a short distance behind her. Let that separation read clearly before the conversation begins.',
  'Give the exchange time to land. The pause is a held moment, not a slow walk. Keep the guard attentive and the background activity unhurried.',
  'Urban turns only after the exchange. Let the turn develop through the shoulders before his attention settles on the water. The camera should leave space for the direction of his look.',
  'Finish with the harbor still moving around them. Hold the composition long enough to read the difference between Mara’s attention and Urban’s.',
];

export function timecode(seconds) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const whole = Math.floor(safe % 60);
  const centiseconds = Math.floor((safe % 1) * 100 + 0.0001);
  return `${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}
