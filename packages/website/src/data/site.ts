import type { ImageMetadata } from 'astro';

import firstPatronShotPlanVideo from '../assets/media/first-patron-shot-plan.mp4';
import actStoryboard from '../assets/screens/act-storyboard.png';
import castGrid from '../assets/screens/cast-grid.png';
import castSheets from '../assets/screens/cast-sheets.png';
import locationDetail from '../assets/screens/location-detail.png';
import sceneBeats from '../assets/screens/scene-beats.png';
import sceneNarrative from '../assets/screens/scene-narrative.png';
import screenplayAnalysis from '../assets/screens/screenplay-analysis.png';
import wesAndersonAnalysis from '../assets/screens/wes-anderson-analysis.png';
import wesAndersonGrabs from '../assets/screens/wes-anderson-grabs.png';

export const site = {
  name: 'Renku',
  tagline: 'Watch your film while you’re still writing it.',
  description:
    'Renku is a filmmaking studio for live-action, hybrid, and fully AI productions. Iterate on your screenplay through FDX, develop your visual language, direct Blender previs, and generate AI footage in one cinematic workspace.',
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
    title: 'Back to the page. With more to go on.',
    description:
      'Keep writing in the screenplay editor you know. Bring your script into Renku through FDX to explore its structure and develop scenes on screen, then return to your editor with a clearer sense of what to rewrite.',
    bullets: [
      'Work with screenplay editors that export Final Draft XML (.fdx)',
      'Renku detects new exports; review affected scenes before applying an update',
      'Story-arc analysis reveals structure, pacing, and character development',
    ],
    image: sceneNarrative,
    imageAlt:
      'A screenplay page in Renku with character and location names highlighted and linked.',
    secondaryImage: screenplayAnalysis,
    secondaryImageAlt:
      'Story arc chart plotting dramatic energy across three acts.',
  },
  {
    id: 'visual-language',
    eyebrow: 'Visual Language',
    title: 'Turn inspiration into a visual grammar',
    description:
      'Collect stills from the films and cinematographers you love. Explore their use of color, light, and composition with your agent, then build lookbooks that give your cast, locations, and generated footage a shared visual direction.',
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
    id: 'cast',
    eyebrow: 'Cast Development',
    title: 'Give every character a face',
    description:
      'Develop the people behind the dialogue: what they want, what they need, how they change, and how they sound. Build portraits, turnarounds, and expression studies to give each character a shared reference across storyboards and generated takes.',
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
    id: 'storyboards',
    eyebrow: 'Beats & Storyboards',
    title: 'Turn narrative Beats into visible scenes',
    description:
      'Find the moments that move a scene forward: a revelation, a hesitation, a shift in power. Develop those beats with your agent and explore them in storyboards to see how the scene holds together.',
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
];

export const shotPlanVideoFeature = {
  id: 'shot-plan-video',
  eyebrow: 'AI Production',
  title: 'Your direction becomes footage',
  description:
    'Bring your cast, visual references, and shot direction into AI generation. Review each take and refine the performance as you build a fully AI film, develop shots for a hybrid production, or explore a scene before a live-action shoot.',
  bullets: [
    'Carry cast, location, and lookbook references into generation',
    'Keep generated takes connected to their Scene and Shot Plan',
    'Review the performance, compare takes, and refine your direction',
  ],
  video: firstPatronShotPlanVideo,
  videoLabel:
    'A silent 12-second generated Shot Plan Video for The First Patron, showing Urban leaning over the council table before Constantine and Notaras.',
};

export const workflow = [
  {
    step: '01',
    title: 'Write & iterate',
    text: 'Your editor, your screenplay. Bring each FDX revision into Renku.',
  },
  {
    step: '02',
    title: 'Define the look',
    text: 'Inspiration, analysis, and lookbooks establish your visual language.',
  },
  {
    step: '03',
    title: 'Develop cast & locations',
    text: 'Faces, turnarounds, and sets shaped by the script and its look.',
  },
  {
    step: '04',
    title: 'Design scene Beats',
    text: 'Narrative units and storyboards with clear intent.',
  },
  {
    step: '05',
    title: 'Direct & generate',
    text: 'Plan shots, rehearse in Blender, and direct AI-generated takes.',
  },
];

export const audiences = [
  {
    title: 'Independent filmmakers',
    text: 'Walk into every meeting with your film already visible. Test the expensive ideas on screen before they cost you a shooting day.',
    accent: 'var(--amber-500)',
  },
  {
    title: 'AI & hybrid filmmakers',
    text: 'Give each generation a directorial brief: cast, look, camera, blocking, and timing. Build fully AI scenes or develop footage alongside live action.',
    accent: 'var(--rose-500)',
  },
  {
    title: 'Screenwriters',
    text: 'Keep writing in the editor you know. Bring FDX revisions into Renku and see how the structure, pacing, and characters play on screen.',
    accent: 'var(--teal-500)',
  },
  {
    title: 'Cinematographers',
    text: 'Explore how a scene feels through its lens, light, and composition. Share lookbooks, boarded coverage, and moving previs with your director and crew.',
    accent: 'var(--coral-500)',
  },
];

export const benefits = [
  {
    title: 'Pitch with proof',
    text: 'Make the film tangible before the pitch. Show the arc, the faces, the blocking, and generated footage alongside your logline.',
  },
  {
    title: 'Iterate before you spend',
    text: 'Test the blocking and camera in Blender before committing to a shooting day or another generation. Refine the scene while changes are easier to make.',
  },
  {
    title: 'One creative workspace',
    text: 'Keep your screenplay, cast, locations, look, Beats, Shot Plans, and takes together. Review script changes with the existing production work in view.',
  },
];
