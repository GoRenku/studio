import type { ImageMetadata } from 'astro';

import actStoryboard from '../assets/screens/act-storyboard.png';
import castGrid from '../assets/screens/cast-grid.png';
import castSheets from '../assets/screens/cast-sheets.png';
import inspirationGrid from '../assets/screens/inspiration-grid.png';
import locationDetail from '../assets/screens/location-detail.png';
import lookbookPalette from '../assets/screens/lookbook-palette.png';
import sceneNarrative from '../assets/screens/scene-narrative.png';
import sceneShots from '../assets/screens/scene-shots.png';
import sceneTakes from '../assets/screens/scene-takes.png';
import storyArc from '../assets/screens/story-arc.png';

export const site = {
  name: 'Renku',
  tagline: 'See your film before you shoot a single frame.',
  description:
    'Renku is a previsualization studio for filmmakers. Import your screenplay and turn it into cast, locations, lookbooks, storyboards, shot lists, and animatic takes — one cinematic workspace.',
  studioUrl: 'http://localhost:5173',
};

export interface Feature {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  image: ImageMetadata;
  imageAlt: string;
  secondaryImage?: ImageMetadata;
  secondaryImageAlt?: string;
}

export const heroImage = {
  image: storyArc,
  alt: 'Renku Studio showing the dramatic-energy story arc of a screenplay across three acts, with plot points from hook to climax.',
};

export const features: Feature[] = [
  {
    id: 'script',
    eyebrow: 'Script & Structure',
    title: 'Your screenplay becomes a living map',
    description:
      'Import your script and Renku breaks it into acts, sequences, and scenes — then reads it like a story editor. Characters and locations are linked right inside the page, and the dramatic-energy arc shows you where the story surges and where it stalls.',
    bullets: [
      'Acts, sequences, and scenes organized automatically',
      'Screenplay pages with characters and locations linked in place',
      'Story-arc analysis: hook, plot points, midpoint, climax — charted',
    ],
    image: sceneNarrative,
    imageAlt:
      'A screenplay page in Renku with character and location names highlighted and linked.',
    secondaryImage: storyArc,
    secondaryImageAlt:
      'Story arc chart plotting dramatic energy across three acts.',
  },
  {
    id: 'cast',
    eyebrow: 'Cast Development',
    title: 'Give every character a face',
    description:
      'Every role in your script gets a profile — want, need, arc, voice — and a generated portrait to match. Character sheets with turnarounds and expression studies keep each face consistent across every storyboard frame and take.',
    bullets: [
      'AI portraits grounded in each character’s role and age',
      'Character sheets: turnarounds, poses, and expression grids',
      'Want, need, arc, and voice notes beside every face',
    ],
    image: castGrid,
    imageAlt:
      'A cast gallery in Renku with generated portraits for each character in the screenplay.',
    secondaryImage: castSheets,
    secondaryImageAlt:
      'Character sheets showing full-body turnarounds and expression studies.',
  },
  {
    id: 'locations',
    eyebrow: 'Locations',
    title: 'Scout places that don’t exist yet',
    description:
      'Build a location library straight from the script — each with period, season, and visual notes. Generate hero images to lock the mood of every set before anyone drives to a scout.',
    bullets: [
      'Every location extracted from the screenplay, with context',
      'Visual notes that carry into image generation',
      'Hero images that set the mood for each scene',
    ],
    image: locationDetail,
    imageAlt:
      'A location page in Renku showing a generated hero image and visual notes.',
  },
  {
    id: 'visual-language',
    eyebrow: 'Visual Language',
    title: 'Turn inspiration into a visual grammar',
    description:
      'Collect stills from the films and cinematographers you love, and let Renku analyze them into a thesis: principles, palette, and rules of composition. Lookbooks turn that grammar into direction every generated frame obeys.',
    bullets: [
      'Inspiration folders for films, DPs, and references',
      'AI analysis: core idea, principles, and a named color palette',
      'Production and storyboard lookbooks steer every generation',
    ],
    image: inspirationGrid,
    imageAlt:
      'An inspiration folder in Renku filled with film stills arranged in a grid.',
    secondaryImage: lookbookPalette,
    secondaryImageAlt:
      'A lookbook color palette with named swatches and usage notes.',
  },
  {
    id: 'storyboards',
    eyebrow: 'Storyboards & Shot Lists',
    title: 'Board every shot, with intent',
    description:
      'Renku drafts a storyboard for every scene — and each frame knows why it exists. Story beat, narrative purpose, subject, and action ride along with every shot, so your coverage reads like a director’s plan, not a pile of pictures.',
    bullets: [
      'Sketch-style boards for every scene, shot by shot',
      'Each shot carries beat, purpose, subject, and action',
      'Whole-act overviews show your coverage at a glance',
    ],
    image: sceneShots,
    imageAlt:
      'A shot list in Renku with storyboard thumbnails and a detailed shot breakdown panel.',
    secondaryImage: actStoryboard,
    secondaryImageAlt:
      'An act overview showing storyboard frames for every scene.',
  },
  {
    id: 'takes',
    eyebrow: 'Takes & Animatics',
    title: 'From boards to moving takes',
    description:
      'Assemble shots into takes and carry them toward motion. The take workspace holds composition, motion, dialog, and references for each shot — with generation cost tracked before you commit a single credit.',
    bullets: [
      'Group shots into takes and iterate on each cut',
      'Composition, motion, dialog, and reference notes per shot',
      'Generation activity and cost, visible at every step',
    ],
    image: sceneTakes,
    imageAlt:
      'The takes view in Renku showing take cards assembled from storyboard shots.',
  },
];

export const workflow = [
  {
    step: '01',
    title: 'Import your script',
    text: 'Fountain to full structure — acts, sequences, scenes.',
  },
  {
    step: '02',
    title: 'Develop cast & locations',
    text: 'Faces, turnarounds, and sets pulled from the page.',
  },
  {
    step: '03',
    title: 'Define the look',
    text: 'Inspiration, analysis, palette — locked into lookbooks.',
  },
  {
    step: '04',
    title: 'Board every shot',
    text: 'Storyboards and shot lists with narrative intent.',
  },
  {
    step: '05',
    title: 'Cut animatic takes',
    text: 'Moving previs, with generation cost in plain sight.',
  },
];

export const audiences = [
  {
    title: 'Independent filmmakers',
    text: 'Walk into every meeting with your film already visible. Test the expensive ideas on screen before they cost you a shooting day.',
    accent: 'var(--amber-500)',
  },
  {
    title: 'Aspiring directors',
    text: 'Direct before anyone hands you a crew. Build the muscle of shot choice, coverage, and visual storytelling on real material — yours.',
    accent: 'var(--rose-500)',
  },
  {
    title: 'Screenwriters',
    text: 'See your pages the way a director will read them. Watch structure, pacing, and character agency charted across every act.',
    accent: 'var(--teal-500)',
  },
  {
    title: 'Cinematographers',
    text: 'Arrive with a visual grammar, not a mood board. Palette, principles, and boarded coverage — ready to argue lens by lens.',
    accent: 'var(--coral-500)',
  },
];

export const benefits = [
  {
    title: 'Pitch with proof',
    text: 'A previs that looks like a film gets funded like one. Show the arc, the faces, and the frames — not just the logline.',
  },
  {
    title: 'Iterate before you spend',
    text: 'Rewrite the shot, not the shoot. Every experiment happens in the studio, where a bad idea costs minutes instead of money.',
  },
  {
    title: 'One source of truth',
    text: 'Script, cast, locations, look, boards, and takes stay linked. Change the scene and everything downstream knows.',
  },
];
