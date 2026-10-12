import type {
  DialogueDirectionLine,
  DialogueDirectionRoute,
  DialogueDirectionSession,
  DialogueDirectionTake,
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
    scripts: null,
    ...change,
  };
}

function sessionBase(): Omit<DialogueDirectionSession, 'initial' | 'route'> {
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

const initialVoices = { 'cast-constantine': 'cast-constantine-tenor', 'cast-urban': 'cast-urban-baritone', 'cast-loukas': 'cast-loukas-clerk', 'cast-giustiniani': 'cast-giustiniani-captain' };

const warmth = (pointer: string) => ({ groups: [{ label: 'Voice', fields: [
  { key: pointer, label: 'Warmth', kind: 'number' as const, minimum: 0, maximum: 1, initialValue: 0.45 },
] }] });

/** A fictional Line Scripts route with Speaker Voices; the panel must render any described route. */
export function lineScriptsRouteFixture(): DialogueDirectionRoute {
  return {
    provider: 'acme-audio', providerLabel: 'Acme Audio', label: 'Acme Voice One',
    scriptLayout: 'line-scripts', voiceBinding: { kind: 'speaker-voices' }, maxVoices: 10, emphasis: 'bracket-tags',
    operations: {
      singleLine: { model: 'acme/voice-one', characterLimit: null, controls: warmth('/voice/warmth'), scriptLocation: { kind: 'text', pointer: '/script' } },
      lineRange: { model: 'acme/voice-one/scene', characterLimit: 2000, controls: warmth('/tuning/warmth'), scriptLocation: { kind: 'line-list', listPointer: '/lines', textPointer: '/words' } },
    },
  };
}

/** A fictional Range Prompt route with Voice References and Voice Mentions. */
export function rangePromptRouteFixture(): DialogueDirectionRoute {
  return {
    provider: 'acme-audio', providerLabel: 'Acme Audio', label: 'Acme Ensemble',
    scriptLayout: 'range-prompt', voiceBinding: { kind: 'voice-references', mentions: ['<v1>', '<v2>', '<v3>'] }, maxVoices: 3, emphasis: 'quoted-spans',
    operations: {
      singleLine: { model: 'acme/ensemble', characterLimit: 2048, controls: { groups: [] }, scriptLocation: { kind: 'text', pointer: '/prompt' } },
      lineRange: { model: 'acme/ensemble', characterLimit: 2048, controls: { groups: [] }, scriptLocation: { kind: 'text', pointer: '/prompt' } },
    },
  };
}

export function lineScriptsSessionFixture(change: Partial<DialogueDirectionSession> = {}, initial: Partial<DialogueDirectionSession['initial']> = {}): DialogueDirectionSession {
  const scripts: Record<number, string> = {
    4: '[quiet] What would you require?',
    5: '[brisk] Bronze. Powder. Charcoal.',
    6: '[flat] This is what the empire can breathe.',
    7: '[cold, quiet] Then the empire is suffocating.',
    8: '[exhales] Yes. But it is still my city.',
    9: '[low] Then buy what may keep it yours.',
  };
  return {
    ...sessionBase(),
    route: lineScriptsRouteFixture(),
    initial: {
      selection: { start: 5, end: 5 },
      scripts: Object.entries(scripts).map(([number, text]) => ({ turnRange: { start: Number(number), end: Number(number) }, text })),
      voices: initialVoices,
      suggestedTags: ['[whispers]', '[short pause]'],
      ...initial,
    },
    ...change,
  };
}

export function rangePromptSessionFixture(change: Partial<DialogueDirectionSession> = {}, initial: Partial<DialogueDirectionSession['initial']> = {}): DialogueDirectionSession {
  return {
    ...sessionBase(),
    route: rangePromptRouteFixture(),
    initial: {
      selection: { start: 7, end: 8 },
      scripts: [{ turnRange: { start: 7, end: 8 }, text: '<v1> is Urban, <v2> is Constantine. "Then the empire is suffocating."' }],
      voices: initialVoices,
      suggestedTags: [],
      ...initial,
    },
    ...change,
  };
}
