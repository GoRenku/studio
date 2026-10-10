import type {
  DialogueDirectionLine,
  DialogueDirectionSession,
  DialogueDirectionTake,
  ElevenV4DirectionInitial,
  SeedAudioDirectionInitial,
} from '@gorenku/studio-codex/dialogue-direction';

const speakers = {
  constantine: { castMemberId: 'cast-constantine', speakerName: 'Constantine' },
  urban: { castMemberId: 'cast-urban', speakerName: 'Urban' },
  loukas: { castMemberId: 'cast-loukas', speakerName: 'Loukas' },
  giustiniani: { castMemberId: 'cast-giustiniani', speakerName: 'Giustiniani' },
};

export function dialogueDirectionLinesFixture(): DialogueDirectionLine[] {
  const line = (number: number, speaker: keyof typeof speakers, plainText: string): DialogueDirectionLine => ({
    number, ...speakers[speaker], isVoiceOver: false, plainText, profileUri: null,
  });
  return [
    line(4, 'constantine', 'What would you require?'),
    line(5, 'urban', 'Bronze. Powder. Charcoal.'),
    line(6, 'loukas', 'This is what the empire can breathe.'),
    line(7, 'urban', 'Then the empire is suffocating.'),
    line(8, 'constantine', 'Yes. But it is still my city.'),
    line(9, 'giustiniani', 'Then buy what may keep it yours.'),
  ];
}

export function dialogueDirectionTakeFixture(takeId: string, start: number, end: number, change: Partial<DialogueDirectionTake> = {}): DialogueDirectionTake {
  return {
    takeId,
    turnRange: { start, end },
    selected: false,
    durationSeconds: 2.5,
    audioUri: `renku-direction://session/media/${takeId}`,
    createdAt: '2026-10-09T10:00:00.000Z',
    matchesRoute: true,
    actingScripts: null,
    ...change,
  };
}

function sessionBase(): Omit<DialogueDirectionSession, 'panel' | 'initial' | 'route'> {
  const voice = (castMemberId: string, name: string) => ({ castVoiceId: `${castMemberId}-${name.toLowerCase()}`, name, sampleUri: `renku-direction://session/media/${castMemberId}-${name.toLowerCase()}` });
  return {
    sessionId: 'session',
    revision: 1,
    shotPlan: { id: 'shot-plan-02-01', title: 'Shot plan 02-01', sceneHeading: 'Imperial Council Chamber' },
    lines: dialogueDirectionLinesFixture(),
    voices: {
      'cast-constantine': [voice('cast-constantine', 'Tenor'), voice('cast-constantine', 'Weary')],
      'cast-urban': [voice('cast-urban', 'Baritone'), voice('cast-urban', 'Hoarse')],
      'cast-loukas': [voice('cast-loukas', 'Clerk')],
      'cast-giustiniani': [voice('cast-giustiniani', 'Captain')],
    },
    takes: [],
    action: null,
    lastCompletedAction: null,
  };
}

export function elevenV4SessionFixture(change: Partial<DialogueDirectionSession> = {}, initial: Partial<ElevenV4DirectionInitial> = {}): DialogueDirectionSession {
  return {
    ...sessionBase(),
    panel: 'eleven-v4',
    route: { provider: 'elevenlabs', speechModel: 'eleven_v4', rangeModel: 'eleven_v4/text-to-dialogue' },
    initial: {
      panel: 'eleven-v4',
      selection: { start: 5, end: 5 },
      actingScripts: {
        4: '[quiet] What would you require?',
        5: '[brisk] Bronze. Powder. Charcoal.',
        6: '[flat] This is what the empire can breathe.',
        7: '[cold, quiet] Then the empire is suffocating.',
        8: '[exhales] Yes. But it is still my city.',
        9: '[low] Then buy what may keep it yours.',
      },
      voices: { 'cast-constantine': 'cast-constantine-tenor', 'cast-urban': 'cast-urban-baritone', 'cast-loukas': 'cast-loukas-clerk', 'cast-giustiniani': 'cast-giustiniani-captain' },
      voiceSettings: { stability: 0.45, similarity: 0.75 },
      suggestedTags: ['[whispers]', '[short pause]'],
      ...initial,
    },
    ...change,
  };
}

export function seedAudioSessionFixture(change: Partial<DialogueDirectionSession> = {}, initial: Partial<SeedAudioDirectionInitial> = {}): DialogueDirectionSession {
  return {
    ...sessionBase(),
    panel: 'seed-audio',
    route: { provider: 'fal-ai', speechModel: 'bytedance/seed-audio-1.0', rangeModel: 'bytedance/seed-audio-1.0' },
    initial: {
      panel: 'seed-audio',
      selection: { start: 7, end: 8 },
      promptMentions: 'audio-tags',
      prompts: [{ turnRange: { start: 7, end: 8 }, prompt: '@Audio1 is Urban, @Audio2 is Constantine. "Then the empire is suffocating."' }],
      voices: { 'cast-constantine': 'cast-constantine-tenor', 'cast-urban': 'cast-urban-baritone', 'cast-loukas': 'cast-loukas-clerk', 'cast-giustiniani': 'cast-giustiniani-captain' },
      ...initial,
    },
    ...change,
  };
}
