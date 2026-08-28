import type { ImageMetadata } from 'astro';

import firstPatronShotPlanVideo from '../assets/media/first-patron-shot-plan.mp4';
import actStoryboard from '../assets/screens/act-storyboard.png';
import castGrid from '../assets/screens/cast-grid.png';
import castSheets from '../assets/screens/cast-sheets.png';
import locationDetail from '../assets/screens/location-detail.png';
import sceneBeats from '../assets/screens/scene-beats.png';
import sceneNarrative from '../assets/screens/scene-narrative.png';
import screenplayAnalysis from '../assets/screens/screenplay-analysis.png';
import shotPlan from '../assets/screens/shot-plan.png';
import wesAndersonAnalysis from '../assets/screens/wes-anderson-analysis.png';
import wesAndersonGrabs from '../assets/screens/wes-anderson-grabs.png';

export const site = {
  name: 'Renku',
  tagline: 'See your film before you shoot a single frame.',
  description:
    'Renku is a previsualization studio for filmmakers. Import your screenplay and turn it into cast, locations, lookbooks, narrative Scene Beats, storyboards, Shot Plans, and video previews — one cinematic workspace.',
  githubUrl: 'https://github.com/GoRenku/studio',
  downloadUrl: '/download',
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
  image: screenplayAnalysis,
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
    secondaryImage: screenplayAnalysis,
    secondaryImageAlt:
      'Story arc chart plotting dramatic energy across three acts.',
  },
  {
    id: 'cast',
    eyebrow: 'Cast Development',
    title: 'Give every character a face',
    description:
      'Every role in your script gets a profile — want, need, arc, voice — and a generated portrait to match. Character sheets with turnarounds and expression studies keep each face consistent across every storyboard frame.',
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
      'Mehmed II character assets showing armored, battlefield, and palace turnarounds and expression studies.',
  },
  {
    id: 'locations',
    eyebrow: 'Locations',
    title: 'Scout places that don’t exist yet',
    description:
      'Build a location library straight from the script — each with period, season, and visual notes. Develop reference imagery, then step inside an explorable 3D World before anyone drives to a scout.',
    bullets: [
      'Every location extracted from the screenplay, with context',
      'Visual notes and reference images that carry into production design',
      '3D Worlds that make space, scale, and camera possibilities tangible',
    ],
    image: locationDetail,
    imageAlt:
      'The Imperial Council Chamber 3D World open in Renku, showing an explorable Byzantine council room.',
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
    image: wesAndersonGrabs,
    imageAlt:
      'The Wes Anderson inspiration folder in Renku with film stills arranged in a grid.',
    secondaryImage: wesAndersonAnalysis,
    secondaryImageAlt:
      'The Wes Anderson inspiration analysis showing its visual thesis, reference stills, and named color palette.',
  },
  {
    id: 'storyboards',
    eyebrow: 'Beats & Storyboards',
    title: 'Turn narrative Beats into visible scenes',
    description:
      'Renku breaks each scene into clear narrative Beats before camera decisions begin. Every Beat carries its people, place, story elements, emotional tone, and narrative function, with storyboard imagery attached as a separate visual layer.',
    bullets: [
      'Narrative Scene Beats stay separate from camera and coverage choices',
      'Each Beat carries narrative development, purpose, cast, and locations',
      'Whole-act overviews show the storyboard flow at a glance',
    ],
    image: sceneBeats,
    imageAlt:
      'The Renku Screenplay view showing storyboard images for The First Patron and its surrounding scenes.',
    secondaryImage: actStoryboard,
    secondaryImageAlt:
      'The First Patron Beats view with storyboard thumbnails and the selected Beat details.',
  },
  {
    id: 'shot-plans',
    eyebrow: 'Shot Planning',
    title: 'Turn story intent into camera decisions',
    description:
      'Build a Shot Plan only after the narrative is clear. Each Shot stays tied to the Beats it covers, while framing, camera angle, movement, optics, focus, and lighting intent live together in one practical brief.',
    bullets: [
      'Author the visual relationship from the opening frame to the closing frame',
      'Plan camera angle, movement, optics, focus, and lighting intent together',
      'Keep every Shot visibly connected to the narrative Beats it covers',
    ],
    image: shotPlan,
    imageAlt:
      'The First Patron Shot Plan in Renku, showing the selected shot’s framing, camera, motion, optics, and lighting brief.',
  },
];

export const shotPlanVideoFeature = {
  id: 'shot-plan-video',
  eyebrow: 'Generated Previs',
  title: 'See the Shot Plan move',
  description:
    'Generate a video preview from the plan and judge the result in motion. This 12-second take from The First Patron carries its intended slow push through the Imperial Council Chamber into a concrete piece of previs.',
  bullets: [
    'Review composition, camera movement, and pacing before production',
    'Keep each generated preview connected to its Scene and Shot Plan',
    'Compare motion against the authored visual intent while it is still easy to change',
  ],
  video: firstPatronShotPlanVideo,
  videoLabel:
    'A silent 12-second generated Shot Plan Video for The First Patron, showing Urban leaning over the council table before Constantine and Notaras.',
};

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
    title: 'Design scene Beats',
    text: 'Narrative units and storyboards with clear intent.',
  },
  {
    step: '05',
    title: 'Plan shots & preview motion',
    text: 'Camera decisions become generated video previews.',
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
    text: 'Rewrite the Beat, not the shoot. Every story experiment happens in the studio, where a bad idea costs minutes instead of money.',
  },
  {
    title: 'One source of truth',
    text: 'Script, cast, locations, look, Beats, and boards stay linked. Change the scene and everything downstream knows.',
  },
];
