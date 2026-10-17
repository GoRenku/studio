import type { ImageMetadata } from 'astro';

import harborBeat1 from '../assets/films/basilica/harbor/beat-01.png';
import harborBeat2 from '../assets/films/basilica/harbor/beat-02.png';
import harborBeat3 from '../assets/films/basilica/harbor/beat-03.png';
import harborBeat4 from '../assets/films/basilica/harbor/beat-04.png';
import harborPrevisPoster from '../assets/films/basilica/harbor/previs-poster.jpg';
import harborPrevisRevisionOne from '../assets/films/basilica/harbor/previs-revision-1.jpg';
import harborTakePoster from '../assets/films/basilica/harbor/take-poster.jpg';
import harborReferenceMara from '../assets/films/basilica/harbor/reference-mara-second-take.jpg';
import harborReferenceUrban from '../assets/films/basilica/harbor/reference-urban-second-take.jpg';
import harborReferenceLocation from '../assets/films/basilica/harbor/reference-harbor-quarter.jpg';
import harborReferenceFirstTake from '../assets/films/basilica/harbor/reference-first-take-frame.jpg';
import harborDirection from '../assets/films/basilica/harbor/take-direction.txt?raw';
import harborDialogueAudio from '../assets/media/harbor-dialogue.mp3';
import harborPrevisVideo from '../assets/media/harbor-blender-previs.mp4';
import harborTakeVideo from '../assets/media/harbor-generation.mp4';
import sintelBeat1 from '../assets/films/sintel/scene-3/beat-01.png';
import sintelBeat2 from '../assets/films/sintel/scene-3/beat-02.png';
import sintelBeat3 from '../assets/films/sintel/scene-3/beat-03.png';
import sintelBeat4 from '../assets/films/sintel/scene-3/beat-04.png';

export type ScreenplayLine =
  | { kind: 'action'; text: string }
  | { kind: 'dialogue'; speaker: string; text: string };

interface StageImage {
  image: ImageMetadata;
  alt: string;
}

interface StoryboardFrame extends StageImage {
  caption: string;
}

interface MadeWithRenkuStage {
  title: string;
  description: string;
  note: string;
}

// Plain text, or a linked phrase such as a license name.
type CreditPart = string | { label: string; href: string };

export interface MadeWithRenkuFilm {
  id: string;
  title: string;
  form: string;
  credit?: CreditPart[];
  scene: MadeWithRenkuStage & { heading: string; lines: ScreenplayLine[] };
  storyboard?: MadeWithRenkuStage & { frames: StoryboardFrame[] };
  previs?: MadeWithRenkuStage & {
    video: string;
    poster: ImageMetadata;
    label: string;
    caption: string;
    earlierRevision: StageImage & { caption: string };
  };
  take?: MadeWithRenkuStage & { video: string; poster: ImageMetadata; label: string; captions: string };
  given?: {
    references: (StageImage & { caption: string })[];
    audio?: { src: string; label: string; caption: string };
    direction: string;
    directionLabel: string;
  };
  links?: { href: string; label: string }[];
}

export const madeWithRenkuFilms: MadeWithRenkuFilm[] = [
  {
    id: 'basilica',
    title: 'Basilica',
    form: 'Live-action drama',
    credit: ['Basilica, a short film by Kerem Karatal. Made with Renku.'],
    scene: {
      title: 'It starts with the page.',
      description: 'Scene 3 of Basilica, “The Harbor Argument”. Two characters, four lines, an evening harbor in 1452.',
      note: 'Written in Renku. Every later stage points back to these lines.',
      heading: 'EXT. HARBOR QUARTER - EVENING',
      lines: [
        { kind: 'action', text: 'Urban and Mara pass refugees mending nets, soldiers mending shields, monks mending hope.' },
        { kind: 'dialogue', speaker: 'Mara', text: 'They are afraid of your gun.' },
        { kind: 'dialogue', speaker: 'Urban', text: 'They are afraid of the man who can afford it.' },
        { kind: 'dialogue', speaker: 'Mara', text: 'Then do not go to him.' },
        { kind: 'dialogue', speaker: 'Urban', text: 'A design unfired is a corpse with clean hands.' },
        { kind: 'action', text: 'Across the water, Ottoman watchfires mark the dark like a second coastline.' },
        { kind: 'dialogue', speaker: 'Mara', text: 'And a design fired?' },
        { kind: 'action', text: 'Urban folds the drawing and tucks it under his coat.' },
        { kind: 'dialogue', speaker: 'Urban', text: 'Work.' },
      ],
    },
    storyboard: {
      title: 'Broken into beats, then storyboarded.',
      description: 'The agent split the scene into seven story beats. Each beat got a storyboard frame to keep or redo.',
      note: 'The first four of the seven beats are shown here.',
      frames: [
        { image: harborBeat1, caption: '1 · A city mends around them', alt: 'Storyboard: Urban and Mara walk along the quay past people mending nets and shields.' },
        { image: harborBeat2, caption: '2 · Fear has a buyer', alt: 'Storyboard: Mara watches the frightened harbor workers while Urban walks half a pace ahead.' },
        { image: harborBeat3, caption: '3 · Mara stops the walk', alt: 'Storyboard: Mara stops beside a rack of patched shields as Urban walks on.' },
        { image: harborBeat4, caption: '4 · The clean-handed corpse', alt: 'Storyboard: Urban turns back toward Mara, the cannon drawing under his coat.' },
      ],
    },
    previs: {
      title: 'Staged and timed in Blender.',
      description: 'Before paying for video, the agent blocked the walk in Blender: who stands where, where the camera goes, and when each line lands.',
      note: 'Three revisions. Revision 3, fitted to 15 seconds, became the motion reference for the take.',
      video: harborPrevisVideo,
      poster: harborPrevisPoster,
      label: 'Blender previs of the harbor walk, revision 3',
      caption: 'Revision 3 · 17 seconds',
      earlierRevision: {
        image: harborPrevisRevisionOne,
        alt: 'Revision 1 of the harbor previs at the same moment, with the camera higher and the figures placed differently.',
        caption: 'Revision 1, same moment',
      },
    },
    take: {
      title: 'Then the take.',
      description: '15 seconds from MiniMax H3 Max on fal.ai, following the previs motion and covering all six lines.',
      note: 'The dialogue was recorded first and given to the video model as an audio reference.',
      video: harborTakeVideo,
      poster: harborTakePoster,
      label: 'Generated take of the harbor walk',
      captions: '/captions/harbor-take.en.vtt',
    },
    given: {
      references: [
        { image: harborReferenceMara, caption: 'Mara · character sheet', alt: 'Mara’s character sheet: turnarounds of a young woman in worn foundry work clothes, with face and hand details.' },
        { image: harborReferenceUrban, caption: 'Urban · character sheet', alt: 'Urban’s character sheet: turnarounds and expressions of a bearded man in heavy wool and leather.' },
        { image: harborReferenceLocation, caption: 'Harbor Quarter · location sheet', alt: 'The Harbor Quarter location sheet: views and a plan of the quay, walls and moored boats.' },
        { image: harborReferenceFirstTake, caption: 'A frame from the first take · photographic finish', alt: 'A frame from the first generated take of the harbor walk, used to carry its photographic finish into the second take.' },
        { image: harborPrevisPoster, caption: 'Previs revision 3 · motion and camera', alt: 'A frame from the Blender previs used as the motion and camera reference.' },
      ],
      audio: {
        src: harborDialogueAudio,
        label: 'Dialogue recording for the harbor scene, all six lines',
        caption: 'Dialogue recording · ElevenLabs v4, all six lines with a delivery note on each',
      },
      direction: harborDirection,
      directionLabel: 'Read the full direction the agent wrote for the video model',
    },
    links: [
      { href: '/journal/how-the-harbor-scene-was-made/', label: 'How the harbor scene was made' },
      { href: '/tutorials/previs-a-dialogue-scene/', label: 'Previs a dialogue scene in Blender' },
      { href: '/tutorials/sample-project/', label: 'Open the sample project' },
    ],
  },
  {
    id: 'sintel',
    title: 'Sintel',
    form: 'Animated short',
    credit: [
      'Sintel © copyright Blender Foundation | ',
      { label: 'durian.blender.org', href: 'https://durian.blender.org/' },
      '. The script is used under ',
      { label: 'CC BY 3.0', href: 'https://creativecommons.org/licenses/by/3.0/' },
      '. Everything else shown here, including the storyboards, was made in Renku Studio.',
    ],
    scene: {
      title: 'It starts with the page.',
      description: 'Scene 3 of Sintel, imported from Final Draft. A girl alone in a back alley, and a wounded creature on the roof.',
      note: 'Imported from Final Draft. Scene 3 of 14.',
      heading: 'EXT - BACK ALLEY NEAR MARKET - DAY',
      lines: [
        { kind: 'action', text: 'On a shingled rooftop, a SHIVERING WINGED CREATURE hobbles weakly across the gutter. In the alley below, a slender young girl clad in leather rummages through empty carts.' },
        { kind: 'dialogue', speaker: 'Shaman (V.O.)', text: 'A perilous quest for a lone hunter.' },
        { kind: 'dialogue', speaker: 'Sintel (V.O.)', text: 'I have been alone for as long as I can remember.' },
        { kind: 'action', text: 'SINTEL pushes aside a crate, revealing her desperate eyes. Suddenly the whimper of a creature sounds from behind her. In a flash SINTEL draws her knife and wheels around.' },
        { kind: 'action', text: 'She glances up and sees the TAIL of a creature slip away over the gutter. Sintel’s eyes flare. She hops onto a crate and vaults nimbly onto the roof, her knife drawn. Sintel faces the shivering BABY CREATURE, dog-/dinosaurlike, with big frightened eyes. A shadow from above crosses the roof.' },
        { kind: 'action', text: 'Sintel hesitates for a moment, still gripping her knife. Her stomach growls momentarily.' },
        { kind: 'action', text: 'But the creature looks up at her with pleading eyes. Sintel focuses on a large nasty slash in its wing. She lowers her weapon.' },
      ],
    },
    storyboard: {
      title: 'Broken into beats, then storyboarded.',
      description: 'Four story beats, storyboarded together in one request with Codex’s built-in image tool.',
      note: 'These four beats cover the whole scene.',
      frames: [
        { image: sintelBeat1, caption: '1 · Two hungry outsiders', alt: 'Storyboard: Sintel searches an empty cart in the alley while a small winged creature crouches on the roof above.' },
        { image: sintelBeat2, caption: '2 · Alarm becomes pursuit', alt: 'Storyboard: knife drawn, Sintel vaults from a crate toward the roof.' },
        { image: sintelBeat3, caption: '3 · Hunger holds the knife', alt: 'Storyboard: on the roof, Sintel crouches with her knife facing a frightened baby dragon.' },
        { image: sintelBeat4, caption: '4 · The wounded wing changes her', alt: 'Storyboard: Sintel sees the baby dragon’s slashed wing and lowers her knife.' },
      ],
    },
  },
];
