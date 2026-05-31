#!/usr/bin/env node

import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(skillDir, '../../..');
const outputRoot = path.join(
  repoRoot,
  'packages/studio/src/features/movie-studio/scenes/shot-design-assets/generated',
);
const consistencyPath = path.join(outputRoot, 'reference/consistency-sheet.png');
const manifestPath = path.join(outputRoot, 'manifest.json');

const consistencyModel = 'fal-ai/nano-banana-pro';
const sheetModel = 'fal-ai/nano-banana-pro/edit';
const motionModel = 'xai/grok-imagine-video/v1.5/image-to-video';
const defaultMotionDurationSeconds = 4;
const defaultMotionResolution = '480p';
const referenceAspectRatio = '4:3';
const sheetAspectRatio = '4:3';

await loadRootEnvFiles();

const { command, options } = parseArgs(process.argv.slice(2));

const ASSETS = [
  asset('shot-size-extreme-close-up', 'Shot Size', 'Extreme Close-Up', 'still', 'An extreme close-up of one expressive eye and cheek texture, filling the frame.'),
  asset('shot-size-close-up', 'Shot Size', 'Close-Up', 'still', 'A close-up portrait of the performer from shoulders up, intimate and direct.'),
  asset('shot-size-medium-close-up', 'Shot Size', 'Medium Close-Up', 'still', 'A medium close-up framing chest and head, with a hint of the pastel ochre hotel set.'),
  asset('shot-size-medium-shot', 'Shot Size', 'Medium Shot', 'still', 'A medium shot from waist up, centered in a refined pastel hotel room.'),
  asset('shot-size-medium-full-shot', 'Shot Size', 'Medium Full Shot', 'still', 'A cowboy-style crop from mid-thigh up, balanced and theatrical.'),
  asset('shot-size-full-shot', 'Shot Size', 'Full Shot', 'still', 'A full-body view of the performer, readable from head to shoes.'),
  asset('shot-size-wide-shot', 'Shot Size', 'Wide / Long Shot', 'still', 'A wide shot where the performer is small but clearly present in the room.'),
  asset('shot-size-extreme-wide-shot', 'Shot Size', 'Extreme Wide / Long Shot', 'still', 'An extreme wide shot emphasizing the full architectural set, with the performer tiny and centered.'),
  asset('subject-single', 'Subject Framing', 'Single', 'still', 'One performer alone in frame, clearly the subject.'),
  asset('subject-two-shot', 'Subject Framing', 'Two-Shot', 'still', 'Two women sharing the frame in balanced profile positions.'),
  asset('subject-three-shot', 'Subject Framing', 'Three-Shot', 'still', 'Three women staged as a clean triangular arrangement.'),
  asset('subject-group', 'Subject Framing', 'Group', 'still', 'A small ensemble grouped in the pastel hotel set with clear spacing.'),
  asset('subject-over-the-shoulder', 'Subject Framing', 'Over-the-Shoulder', 'still', 'A close conversation scene at a dinner table: blurred foreground back-of-head and shoulder of another seated woman frame the main woman across the table in close-up or medium close-up, with visible eyeline and dialogue tension. No men.'),
  asset('subject-over-the-hip', 'Subject Framing', 'Over-the-Hip', 'still', 'A low over-the-hip composition: the foreground hip and side of a standing woman form a near-frame edge, while the main woman is the focused subject beyond, seated or lower in the frame to suggest uneven height and power imbalance. No men.'),
  asset('subject-point-of-view', 'Subject Framing', 'Point of View', 'still', 'A true subjective POV from the main woman: do not show the main woman, her dress, her hands, or her body; show what she sees from her eye level, such as two other women leaning over a table looking directly toward camera in the pastel hotel room. The viewed women and table detail must be sharp and readable, not blurry. No men.'),
  asset('subject-insert', 'Subject Framing', 'Insert', 'still', 'A close-up insert of an important scene detail only, not a portrait: a brass hotel key and small folded note on a pale ochre desk, isolated as story information with no face visible.'),
  asset('subject-reaction', 'Subject Framing', 'Reaction', 'still', 'A close or medium-close reaction shot of the woman responding to something off-camera, with her eyeline clearly aimed just outside the frame. The shot is about reaction, not a new camera angle.'),
  asset('angle-eye-level', 'Camera Angle / Height', 'Eye Level', 'still', 'A neutral straight-on eye-level shot: the lens is exactly at the woman\'s eye height, horizon and architecture feel natural, with no looking up or down.'),
  asset('angle-low-angle', 'Camera Angle / Height', 'Low Angle', 'still', 'A low-angle shot: the camera is physically below the woman\'s eye line and tilts upward, making her and the tall hotel columns feel more imposing. Show ceiling or upper architecture to prove the upward view.'),
  asset('angle-high-angle', 'Camera Angle / Height', 'High Angle', 'still', 'A high-angle shot: the camera is above the woman and looks down obliquely, making her feel smaller within the patterned floor and room. This is not a straight-down overhead shot.'),
  asset('angle-overhead', 'Camera Angle / Height', 'Overhead', 'still', 'A true overhead bird\'s-eye shot: the camera looks straight down from above at the woman and the patterned floor, with strong top-down geometry and minimal wall perspective.'),
  asset('angle-shoulder-level', 'Camera Angle / Height', 'Shoulder Level', 'still', 'A shoulder-level shot: the camera lens sits at the woman\'s shoulder height, slightly below eye level, framing her upper torso and shoulders with a subtly more grounded presence.'),
  asset('angle-hip-level', 'Camera Angle / Height', 'Hip Level', 'still', 'A hip-level camera-height shot, not an over-the-hip shot: the lens sits near the woman\'s waist/hip height, emphasizing hands, beltline, dress, and vertical architecture while looking slightly upward.'),
  asset('angle-knee-level', 'Camera Angle / Height', 'Knee Level', 'still', 'A knee-level shot: the lens sits around the woman\'s knee height, with legs, lower dress, floor pattern, and rising columns prominent. It is low, but not on the ground.'),
  asset('angle-ground-level', 'Camera Angle / Height', 'Ground Level', 'still', 'The lens sits almost on the floor, looking across polished tile toward the performer.'),
  asset('movement-static', 'Camera Motion', 'Static', 'still', 'A locked-off tripod frame: perfectly stable, symmetrical, no pan, no tilt, no dolly, no zoom, and no motion blur.'),
  asset('movement-pan', 'Camera Motion', 'Pan', 'motion', 'No person. Empty exterior hotel garden wide composition with terrace seating or fountain on one side, facade, hedges, and archway on the other; fixed camera pivots horizontally across the exterior location.', 'Smooth horizontal pan from a fixed position across the empty hotel exterior and garden, revealing facade, terrace, hedges, fountain or garden path. No people. No dolly, no tracking, no zoom.'),
  asset('movement-tilt', 'Camera Motion', 'Tilt', 'motion', 'Person included. Low frame on the woman\'s shoes, lower dress, gravel or stone path, steps, and facade base; fixed camera tilts upward to her torso, face, and upper hotel facade, balcony, or arched window.', 'Smooth vertical tilt upward from the woman\'s shoes and exterior path to her torso, face, and upper hotel facade, fixed camera position.'),
  asset('movement-swish-pan', 'Camera Motion', 'Swish Pan', 'motion', 'No person. Empty garden path or terrace with hedge, fountain, column, or doorway at one edge and a second exterior area across frame; fast horizontal whip pan with controlled blur.', 'Fast horizontal swish pan from a fixed position across the empty garden exterior with tasteful directional motion blur, landing on another readable exterior area. No people.'),
  asset('movement-swish-tilt', 'Camera Motion', 'Swish Tilt', 'motion', 'No person. Low empty exterior frame with gravel path, flowers, stone steps, planter, and facade base; fast vertical whip tilt upward.', 'Fast vertical swish tilt through empty exterior lines, from garden path and stone details up to balcony, upper facade, arched window, or tree canopy. No people.'),
  asset('movement-tracking', 'Camera Motion', 'Tracking', 'motion', 'Person included. Side-profile woman walking along a garden path or terrace, with foreground hedges or columns and background facade; camera travels sideways with her at constant distance.', 'Gentle sideways tracking move following the walking woman along the garden path or terrace at a constant distance, stable and cinematic, with foreground/background parallax.'),
  asset('movement-push-in', 'Camera Motion', 'Push-In', 'motion', 'Person included. Medium-wide centered frame of the woman at garden gate, stone steps, terrace, or arched doorway, with exterior depth around her; camera physically moves forward toward her.', 'Slow dolly push-in toward the woman at the garden or hotel exterior with subtle parallax and changing spatial relationships, steady and restrained.'),
  asset('movement-pull-out', 'Camera Motion', 'Pull-Out', 'motion', 'Person included. Medium-close frame of the woman near center, with limited garden or facade visible; camera physically moves backward to reveal the larger hotel exterior and garden.', 'Slow dolly pull-out from the woman, revealing more of the hotel exterior and garden with stable parallax and elegant composition.'),
  asset('movement-zoom', 'Camera Motion', 'Zoom', 'motion', 'Person included. Locked-off centered frame of the woman with strong facade, terrace, path, or hedge lines around her; optical zoom changes crop without camera movement or parallax.', 'Optical zoom inward toward the woman at the hotel exterior while the camera position remains fixed, no dolly movement and no parallax shift.'),
  asset('rig-sticks', 'Rig / Mechanism', 'Sticks', 'still', 'A camera on sticks: a grounded tripod viewpoint with perfectly level horizon, formal composition, crisp detail, no handheld shake, and no implied movement.'),
  asset('rig-hand-held', 'Rig / Mechanism', 'Hand-Held', 'still', 'A handheld-feeling frame: intimate human-operated looseness, very slight off-level framing and organic micro-instability, but still polished, readable, and not chaotic.'),
  asset('rig-gimbal', 'Rig / Mechanism', 'Gimbal', 'still', 'A smooth floating frame following the performer through a corridor.'),
  asset('rig-slider', 'Rig / Mechanism', 'Slider', 'still', 'A short lateral slider move implied by foreground parallax on the counter.'),
  asset('rig-jib', 'Rig / Mechanism', 'Jib', 'still', 'A gentle elevated jib perspective over the performer in the room.'),
  asset('rig-drone', 'Rig / Mechanism', 'Drone', 'still', 'A high floating view above an open courtyard-like interior.'),
  asset('rig-dolly', 'Rig / Mechanism', 'Dolly', 'still', 'A dolly-track feeling with strong centered lines leading toward the performer.'),
  asset('rig-steadicam', 'Rig / Mechanism', 'Steadicam', 'still', 'A graceful walking perspective behind the performer, smooth and balanced.'),
  asset('rig-crane', 'Rig / Mechanism', 'Crane', 'still', 'A sweeping high crane-like vantage over staircase and subject.'),
  asset('lens-ultra-wide', 'Lens', 'Ultra-Wide', 'still', 'An ultra-wide view with exaggerated room geometry and the subject centered.'),
  asset('lens-wide', 'Lens', 'Wide', 'still', 'A wide lens view balancing the performer with visible environment.'),
  asset('lens-normal', 'Lens', 'Normal', 'still', 'A natural-perspective view with minimal distortion.'),
  asset('lens-short-tele', 'Lens', 'Short Tele', 'still', 'A gently compressed portrait view with soft background separation.'),
  asset('lens-tele', 'Lens', 'Tele', 'still', 'A compressed telephoto-feeling frame with layered set pieces behind the subject.'),
  asset('lens-macro', 'Lens', 'Macro', 'still', 'A macro close-up of a small prop with the performer softly suggested behind it.'),
  asset('focus-deep-focus', 'Focus / DOF', 'Deep Focus', 'still', 'Foreground, performer, and background architecture all read sharply.'),
  asset('focus-shallow-focus', 'Focus / DOF', 'Shallow Focus', 'still', 'The performer is crisp while the pastel hotel background falls softly out of focus.'),
  asset('focus-rack-focus', 'Focus / DOF', 'Rack Focus', 'motion', 'Foreground prop and background performer are staged for a focus shift.', 'Rack focus from a foreground key or flower to the performer in the background, with no camera move.'),
  asset('focus-tilt-shift', 'Focus / DOF', 'Tilt-Shift', 'still', 'A miniature-like plane of focus across the symmetrical room.'),
];

const sheetCells = chunkWithFillers(ASSETS, 4);
const SHEETS = [
  sheet(1, 'shot-size-close', 'Close Shot Sizes'),
  sheet(2, 'shot-size-wide', 'Wide Shot Sizes'),
  sheet(3, 'subject-grouping', 'Subject Grouping'),
  sheet(4, 'subject-perspective', 'Subject Perspective'),
  sheet(5, 'angle-basic', 'Basic Angles'),
  sheet(6, 'angle-height', 'Camera Heights'),
  sheet(7, 'movement-foundation', 'Foundational Movement'),
  sheet(8, 'movement-dynamic', 'Dynamic Movement'),
  sheet(9, 'movement-rig-basic', 'Movement + Basic Rigs'),
  sheet(10, 'rig-mobile', 'Mobile Rigs'),
  sheet(11, 'rig-elevated-lens', 'Elevated Rigs + Ultra-Wide Lens'),
  sheet(12, 'lens-field', 'Lens Field'),
  sheet(13, 'focus-depth', 'Focus Depth'),
  sheet(14, 'focus-special', 'Special Focus'),
];

if (command === 'reference') {
  await requireYes(options, 'reference generation');
  await generateReference(options);
} else if (command === 'sheet') {
  await requireYes(options, 'sheet generation');
  await generateSheet(options);
} else if (command === 'motion-frame') {
  await requireYes(options, 'motion start-frame generation');
  await generateMotionFrame(options);
} else if (command === 'motion') {
  await requireYes(options, 'motion generation');
  await generateMotion(options);
} else if (command === 'status') {
  await printStatus();
} else if (command === 'plan') {
  printPlan();
} else {
  throw new Error(`Unknown command: ${command}`);
}

function asset(id, axis, label, kind, description, motionPrompt = null) {
  return { id, axis, label, kind, description, motionPrompt };
}

function sheet(number, name, title) {
  return { number, name, title };
}

function parseArgs(argv) {
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'plan';
  const rest = command === 'plan' && argv[0] !== 'plan' ? argv : argv.slice(1);
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--yes') options.yes = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--number') {
      options.number = Number(rest[index + 1]);
      index += 1;
    } else if (arg === '--name' || arg === '--sheet') {
      options.name = rest[index + 1];
      index += 1;
    } else if (arg === '--asset') {
      options.asset = rest[index + 1];
      index += 1;
    } else if (arg === '--duration') {
      options.duration = Number(rest[index + 1]);
      index += 1;
    } else if (arg === '--resolution') {
      options.resolution = rest[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { command, options };
}

async function requireYes(options, action) {
  if (!options.yes) {
    throw new Error(`${action} contacts a provider and requires --yes.`);
  }
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY is required in the project root .env or .env.local file.');
  }
}

async function generateReference(options) {
  await prepareFolders();
  if (!options.force && await fileExists(consistencyPath)) {
    throw new Error('reference/consistency-sheet.png already exists. Pass --force to replace it.');
  }
  const fal = await loadFal();
  const prompt = buildReferencePrompt();
  const result = await fal.subscribe(consistencyModel, {
    input: commonImageInput(prompt, referenceAspectRatio),
  });
  await downloadToFile(firstImageUrl(result.data), consistencyPath);
  const manifest = await readManifestOrCreate();
  manifest.reference = {
    path: relativeOutputPath(consistencyPath),
    model: consistencyModel,
    requestId: result.requestId ?? null,
    prompt,
    status: 'review_required',
  };
  await writeManifest(manifest);
  console.log(relativeOutputPath(consistencyPath));
}

async function generateSheet(options) {
  const selectedSheet = resolveSheetSelection(options);
  await prepareFolders();
  if (!await fileExists(consistencyPath)) {
    throw new Error('reference/consistency-sheet.png is required first. Generate the consistency reference, inspect it, and continue only after user approval.');
  }
  const sheetPath = path.join(outputRoot, 'sheets', `sheet-${String(selectedSheet.number).padStart(3, '0')}.png`);
  if (!options.force && await fileExists(sheetPath)) {
    throw new Error(`${relativeOutputPath(sheetPath)} already exists. Pass --force to replace it.`);
  }
  const fal = await loadFal();
  const refUrl = await uploadPng(fal, consistencyPath);
  const prompt = buildSheetPrompt(sheetCells[selectedSheet.number - 1], selectedSheet);
  const result = await fal.subscribe(sheetModel, {
    input: {
      ...commonImageInput(prompt, sheetAspectRatio),
      image_urls: [refUrl],
    },
  });
  await downloadToFile(firstImageUrl(result.data), sheetPath);
  const manifest = await readManifestOrCreate();
  upsertByKey(manifest.sheets, 'number', {
    number: selectedSheet.number,
    name: selectedSheet.name,
    title: selectedSheet.title,
    path: relativeOutputPath(sheetPath),
    model: sheetModel,
    referencePath: relativeOutputPath(consistencyPath),
    requestId: result.requestId ?? null,
    prompt,
    status: 'review_required',
  });
  await writeManifest(manifest);
  console.log(relativeOutputPath(sheetPath));
}

async function generateMotionFrame(options) {
  const source = ASSETS.find((entry) => entry.id === options.asset);
  if (!source || source.kind !== 'motion') {
    throw new Error(`Unknown motion asset. Use one of: ${motionIds().join(', ')}`);
  }
  await prepareFolders();
  if (!await fileExists(consistencyPath)) {
    throw new Error('reference/consistency-sheet.png is required before motion start-frame generation.');
  }
  const imagePath = path.join(outputRoot, 'images', `${source.id}.png`);
  if (!options.force && await fileExists(imagePath)) {
    throw new Error(`${relativeOutputPath(imagePath)} already exists. Pass --force to replace it.`);
  }
  const locationAnchorPath = await resolveMovementLocationAnchorPath(source);
  const fal = await loadFal();
  const referenceUrl = await uploadPng(fal, consistencyPath);
  const imageUrls = [referenceUrl];
  if (locationAnchorPath) {
    imageUrls.push(await uploadPng(fal, locationAnchorPath));
  }
  const prompt = buildMotionFramePrompt(source, { hasLocationAnchor: Boolean(locationAnchorPath) });
  const result = await fal.subscribe(sheetModel, {
    input: {
      ...commonImageInput(prompt, '16:9'),
      image_urls: imageUrls,
    },
  });
  await downloadToFile(firstImageUrl(result.data), imagePath);
  const manifest = await readManifestOrCreate();
  upsertByKey(manifest.images, 'id', {
    id: source.id,
    path: relativeOutputPath(imagePath),
    sourceSheet: null,
    locationReferencePath: locationAnchorPath ? relativeOutputPath(locationAnchorPath) : null,
    model: sheetModel,
    requestId: result.requestId ?? null,
    prompt,
    status: 'review_required',
  });
  await writeManifest(manifest);
  console.log(relativeOutputPath(imagePath));
}

async function generateMotion(options) {
  const source = ASSETS.find((entry) => entry.id === options.asset);
  if (!source || source.kind !== 'motion') {
    throw new Error(`Unknown motion asset. Use one of: ${motionIds().join(', ')}`);
  }
  await prepareFolders();
  const imagePath = path.join(outputRoot, 'images', `${source.id}.png`);
  if (!await fileExists(imagePath)) {
    throw new Error(`${relativeOutputPath(imagePath)} is required before motion generation. Generate and inspect a dedicated first frame first with: motion-frame --asset ${source.id} --yes`);
  }
  const motionPath = path.join(outputRoot, 'motion', `${source.id}.mp4`);
  if (!options.force && await fileExists(motionPath)) {
    throw new Error(`${relativeOutputPath(motionPath)} already exists. Pass --force to replace it.`);
  }
  const duration = resolveMotionDuration(options);
  const resolution = resolveMotionResolution(options);
  const fal = await loadFal();
  const imageUrl = await uploadPng(fal, imagePath);
  const prompt = buildMotionPrompt(source);
  const result = await fal.subscribe(motionModel, {
    input: {
      prompt,
      image_url: imageUrl,
      duration,
      resolution,
    },
  });
  await downloadToFile(videoUrl(result.data), motionPath);
  const manifest = await readManifestOrCreate();
  upsertByKey(manifest.motion, 'id', {
    id: source.id,
    path: relativeOutputPath(motionPath),
    inputPath: relativeOutputPath(imagePath),
    model: motionModel,
    requestId: result.requestId ?? null,
    prompt,
    duration,
    resolution,
    status: 'review_required',
  });
  await writeManifest(manifest);
  console.log(relativeOutputPath(motionPath));
}

function printPlan() {
  console.log('Shot Design asset generation plan');
  console.log('Estimated provider cost: $0.15 reference + $0.15 per 4-cell sheet + $0.33 per 4s 480p motion preview with one input image.');
  console.log('1. reference --yes');
  for (let index = 0; index < sheetCells.length; index += 1) {
    const selectedSheet = SHEETS[index];
    console.log(`${index + 2}. sheet --number ${selectedSheet.number} --yes`);
    console.log(`   name: ${selectedSheet.name}`);
    console.log(`   title: ${selectedSheet.title}`);
    console.log(`   ${sheetCells[index].map((cell) => cell.id).join(', ')}`);
  }
  console.log('Movement motion frame commands:');
  for (const id of movementMotionIds()) {
    console.log(`motion-frame --asset ${id} --yes`);
  }
  console.log('Movement motion preview commands:');
  for (const id of movementMotionIds()) {
    console.log(`motion --asset ${id} --yes`);
  }
  console.log('Movement motion ids:');
  console.log(movementMotionIds().join(', '));
}

async function printStatus() {
  console.log('Shot Design asset generation status');
  console.log(`reference: ${await fileExists(consistencyPath) ? 'exists' : 'missing'} (${relativeOutputPath(consistencyPath)})`);
  for (const selectedSheet of SHEETS) {
    const sheetPath = path.join(outputRoot, 'sheets', `sheet-${String(selectedSheet.number).padStart(3, '0')}.png`);
    const cells = sheetCells[selectedSheet.number - 1];
    const expectedSlices = cells.filter((cell) => cell.kind !== 'filler').length;
    console.log(`sheet ${selectedSheet.number} ${selectedSheet.name}: ${await fileExists(sheetPath) ? 'exists' : 'missing'} (${await countExistingSlices(cells)}/${expectedSlices} slices)`);
  }
  for (const source of ASSETS.filter((entry) => entry.kind === 'motion')) {
    const imagePath = path.join(outputRoot, 'images', `${source.id}.png`);
    const motionPath = path.join(outputRoot, 'motion', `${source.id}.mp4`);
    console.log(`motion ${source.id}: still ${await fileExists(imagePath) ? 'exists' : 'missing'}, video ${await fileExists(motionPath) ? 'exists' : 'missing'}`);
  }
}

function commonImageInput(prompt, aspectRatio) {
  return {
    prompt,
    num_images: 1,
    enable_web_search: false,
    resolution: '2K',
    aspect_ratio: aspectRatio,
    output_format: 'png',
    sync_mode: false,
    limit_generations: true,
  };
}

function buildReferencePrompt() {
  return [
    'Create one 4:3 consistency reference sheet for a Renku Studio camera-design UI tile set.',
    'Compose it like a practical visual reference board with multiple bordered image panels distributed across the full canvas, not a rigid UI grid and not a single scene.',
    'The reference board must lock one original unnamed female performer across all performer panels: fair skin, soft oval face, center-parted brown hair pinned into a neat low bun, understated expression, no jewelry, no bag, no changing accessories.',
    'Lock one simple wardrobe across all performer panels: timeless cream dress with pale mint-sage paneling and soft ivory outer layer, refined and cinematic, not a historic costume, not a jacket, not a blazer.',
    'Include performer panels for close portrait, full body, three-quarter pose, profile, and small figure in environment. The same face, hair, dress, and absence of accessories must remain consistent.',
    'Show a pastel Mustard Lobby world: European hotel lobby, corridor, room corner, patterned floor, architectural details, polished wood, plaster, tile, upholstery, and soft lamps.',
    'Use a softened application-compatible palette: pastel ochre and antique gold as warm architectural accents, parchment cream as the base, pale mint-sage as the key secondary color, muted terracotta material warmth, small oxblood details, and warm ink shadows.',
    'The tone should be closer to pastel palace-hotel softness than saturated yellow: dusty rose-plaster warmth may appear subtly in walls or background atmosphere, but blush, rose, and pink must not dominate the palette.',
    'This palette must harmonize with Renku Studio light and dark themes: warm amber and parchment in light mode, neutral gray surfaces with amber identity accents in dark mode.',
    'Avoid bright warning-yellow, saturated mustard clothing, modern handbags, changing jewelry, changing hair, extra costumes, and inconsistent accessories.',
    'Use soft frontal light, gentle contrast, centered formal staging, refined theatrical production design, and enough warm ink, oxblood, wood, and shadow detail for downstream 16:9 tiles to read in both light and dark UI themes.',
    'This is a reference sheet, not a UI tile. Do not include text, labels, captions, logos, watermarks, UI controls, crop marks, or explanatory typography.',
  ].join('\n');
}

function buildSheetPrompt(cells, selectedSheet) {
  const movementGuidance = selectedSheet.name.startsWith('movement-')
    ? [
      'Movement grammar for these stills must be precise: pan and tilt rotate from a fixed camera position; tracking moves the whole camera sideways with parallax; push-in and pull-out physically move the camera forward or backward with parallax; zoom changes lens focal length from a locked camera position with no parallax.',
      'For swish or whip movement cells, show controlled directional motion blur only where the fast movement is the concept. Keep all other cells crisp and usable as still UI tiles.',
    ]
    : [];
  const angleGuidance = sheetSpecificPromptNotes(selectedSheet);
  return [
    `Create sheet ${selectedSheet.number} (${selectedSheet.title}) of a Renku Studio camera-design UI tile set.`,
    'Use the provided reference image as binding source for character identity, hairstyle, wardrobe, lack of accessories, environment, pastel color palette, lighting, lens feeling, and production design.',
    'The new sheet must look like it came from the exact same origin as the reference image. When the main woman is visible, keep the same woman, same center-parted low bun, same cream and pale mint-sage dress, and no added jewelry, bags, jackets, or changing accessories.',
    'For true POV and insert-shot cells, do not force the main woman to appear. POV should show what she sees. Insert should isolate an important object, detail, or small action.',
    'Create one 4:3 sheet containing exactly four separate 16:9 cinematic stills in a clean 2x2 arrangement. Each still should be easy to crop as a standalone 16:9 image.',
    'It is acceptable for the 4:3 sheet to have tasteful parchment margins and gutters around the 16:9 stills. Do not stretch cells or make square cells.',
    'Use the pastel Mustard Lobby palette: parchment cream, pale mint-sage, pastel ochre or antique gold architecture, muted terracotta materials, tiny oxblood details, and warm ink contrast. Avoid saturated yellow and pink-dominant scenes.',
    'No text, captions, numbers, watermarks, UI controls, crop marks, or labels inside any cell.',
    ...angleGuidance,
    ...movementGuidance,
    'Cells in reading order:',
    ...cells.map((cell, index) => `${index + 1}. ${cell.label}: ${cell.description}`),
  ].join('\n');
}

function sheetSpecificPromptNotes(selectedSheet) {
  if (selectedSheet.name === 'angle-basic') {
    return [
      'For this angle sheet, make the camera placement unmistakable. Do not confuse eye level, low angle, and high angle.',
      'Eye level must feel neutral and straight-on. Low angle must clearly look upward from below the subject. High angle must clearly look down from above but remain oblique, not overhead.',
    ];
  }
  if (selectedSheet.name === 'angle-height') {
    return [
      'For this height sheet, make camera height unmistakable. Do not confuse overhead, shoulder level, hip level, and knee level.',
      'Overhead must be a true top-down bird\'s-eye view. Shoulder level sits near shoulder height, slightly below eye level. Hip level is a camera-height shot near the waist, not an over-the-hip foreground framing. Knee level is low near the knees, not floor or ground level.',
    ];
  }
  return [];
}

function buildMotionFramePrompt(source, options = {}) {
  const locationAnchorGuidance = options.hasLocationAnchor
    ? [
      'Use the second reference image as the binding source for the exterior hotel location: same facade, garden, fountain, terrace, paths, hedges, color, and time of day.',
      'Adapt the camera height and framing for this specific motion, but do not invent a different hotel, garden, season, or architectural style.',
    ]
    : [];
  return [
    `Create one 16:9 first-frame image for the "${source.label}" Shot Design motion preview.`,
    ...motionFrameSubjectGuidance(source),
    ...locationAnchorGuidance,
    'Motion start frames use the Pastel Garden Hotel Exterior direction only: elegant European hotel, manor, or villa facade, garden path, terrace, hedges, fountain, stone steps, veranda, balcony, arched windows, shutters, and planted foreground layers.',
    'Do not show lobby interiors, reception desks, check-in counters, luggage, guests, tourism signage, street storefronts, film sets, soundstages, visible crew, cameras, lights, set flats, floor tape, or behind-the-scenes production language.',
    'This is not a contact sheet, not a diagram, and not a visual explanation of motion. It is the clean starting image that an image-to-video model will animate.',
    'Make the frame cinematic, spacious, and physically plausible for the requested camera move. Preserve clear exterior architecture, garden paths, facade lines, planted foreground layers, and enough off-screen implied space for the motion to read.',
    'Use a crisp still frame unless the motion itself explicitly needs to begin in a whip or swish transition. Do not add arrows, labels, text, numbers, UI controls, crop marks, logos, or watermarks.',
    'Movement intent:',
    `${source.label}: ${source.description}`,
  ].join('\n');
}

function buildMotionPrompt(source) {
  return [
    source.motionPrompt,
    'Create a short elegant camera-design preview from this still image.',
    source.description.startsWith('No person.')
      ? 'Preserve the empty exterior garden location, color palette, lighting, and composition. Do not add any person.'
      : 'Preserve the original subject identity, exterior garden location, color palette, wardrobe, and composition.',
    'Keep motion smooth, restrained, and useful as a UI preview.',
    'Do not add text, captions, graphics, logos, watermarks, or new characters.',
  ].join(' ');
}

function chunkWithFillers(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    while (chunk.length < size) {
      chunk.push(asset(`filler-${chunks.length + 1}-${chunk.length + 1}`, 'Filler', 'Ignored Filler', 'filler', 'A quiet neutral empty room detail used only to fill the provider grid.'));
    }
    chunks.push(chunk);
  }
  return chunks;
}

function motionIds() {
  return ASSETS.filter((entry) => entry.kind === 'motion').map((entry) => entry.id);
}

function movementMotionIds() {
  return motionIds().filter((id) => id.startsWith('movement-'));
}

async function resolveMovementLocationAnchorPath(source) {
  if (!source.id.startsWith('movement-') || source.id === 'movement-pan') {
    return null;
  }
  const anchorPath = path.join(outputRoot, 'images', 'movement-pan.png');
  if (!await fileExists(anchorPath)) {
    throw new Error(`${relativeOutputPath(anchorPath)} is required as the movement location anchor before generating ${source.id}. Generate and approve movement-pan first.`);
  }
  return anchorPath;
}

function motionFrameSubjectGuidance(source) {
  if (source.description.startsWith('No person.')) {
    return [
      'This motion preview must not include any person: no woman, no face, no body, no hands, no human silhouette, and no reflections of people.',
      'Use the reference only for palette, lighting, architectural language, materials, and production design; move the actual location to the Pastel Garden Hotel Exterior direction.',
    ];
  }
  return [
    'Use the provided reference image as binding source for the same woman, center-parted low bun, cream dress with pale mint-sage paneling, lack of accessories, lighting, palette, and production design; move the actual location to the Pastel Garden Hotel Exterior direction.',
    'Keep the woman visually consistent with the reference whenever she is visible.',
  ];
}

function resolveMotionDuration(options) {
  const duration = options.duration ?? defaultMotionDurationSeconds;
  if (!Number.isInteger(duration) || duration < 1 || duration > 15) {
    throw new Error('--duration must be an integer from 1 to 15.');
  }
  return duration;
}

function resolveMotionResolution(options) {
  const resolution = options.resolution ?? defaultMotionResolution;
  if (resolution !== '480p' && resolution !== '720p') {
    throw new Error('--resolution must be either 480p or 720p.');
  }
  return resolution;
}

function resolveSheetSelection(options) {
  if (options.name && options.number) {
    throw new Error('Use either --number or --name, not both.');
  }
  if (options.name) {
    const normalizedName = normalizeSheetName(options.name);
    const byName = SHEETS.find((entry) => entry.name === normalizedName);
    if (!byName) {
      throw new Error(`Unknown sheet name "${options.name}". Use one of: ${SHEETS.map((entry) => entry.name).join(', ')}`);
    }
    return byName;
  }
  if (!Number.isInteger(options.number) || options.number < 1 || options.number > sheetCells.length) {
    throw new Error(`--number must be an integer from 1 to ${sheetCells.length}, or use --name with one of: ${SHEETS.map((entry) => entry.name).join(', ')}`);
  }
  return SHEETS[options.number - 1];
}

function normalizeSheetName(name) {
  return String(name).trim().toLowerCase().replaceAll('_', '-');
}

async function countExistingSlices(cells) {
  let count = 0;
  for (const cell of cells) {
    if (cell.kind === 'filler') continue;
    if (await fileExists(path.join(outputRoot, 'images', `${cell.id}.png`))) {
      count += 1;
    }
  }
  return count;
}

async function loadFal() {
  const requireFromEngines = createRequire(path.join(repoRoot, 'packages/engines/package.json'));
  const modulePath = requireFromEngines.resolve('@fal-ai/client');
  const { fal } = await import(modulePath);
  fal.config({ credentials: process.env.FAL_KEY });
  return fal;
}

async function uploadPng(fal, filePath) {
  const buffer = await readFile(filePath);
  return fal.storage.upload(new Blob([buffer], { type: 'image/png' }));
}

async function downloadToFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

function firstImageUrl(output) {
  const url = output?.images?.[0]?.url;
  if (!url) {
    throw new Error(`Provider image output did not include images[0].url: ${JSON.stringify(output)}`);
  }
  return url;
}

function videoUrl(output) {
  const url = output?.video?.url;
  if (!url) {
    throw new Error(`Provider video output did not include video.url: ${JSON.stringify(output)}`);
  }
  return url;
}

async function prepareFolders() {
  await mkdir(path.join(outputRoot, 'reference'), { recursive: true });
  await mkdir(path.join(outputRoot, 'sheets'), { recursive: true });
  await mkdir(path.join(outputRoot, 'images'), { recursive: true });
  await mkdir(path.join(outputRoot, 'motion'), { recursive: true });
}

async function readManifestOrCreate() {
  try {
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    parsed.sheets ??= [];
    parsed.images ??= [];
    parsed.motion ??= [];
    return parsed;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {
        generatedBy: 'generate-assets',
        outputRoot: path.relative(repoRoot, outputRoot),
        sheets: [],
        images: [],
        motion: [],
      };
    }
    throw error;
  }
}

async function writeManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function upsertByKey(collection, key, record) {
  const index = collection.findIndex((entry) => entry[key] === record[key]);
  if (index === -1) {
    collection.push(record);
  } else {
    collection[index] = record;
  }
}

function relativeOutputPath(filePath) {
  return path.relative(outputRoot, filePath).split(path.sep).join('/');
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function loadRootEnvFiles() {
  const protectedKeys = new Set(Object.keys(process.env));
  for (const fileName of ['.env', '.env.local']) {
    const envPath = path.join(repoRoot, fileName);
    let contents;
    try {
      contents = await readFile(envPath, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed && !protectedKeys.has(parsed.key)) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) return null;
  const key = trimmed.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  return {
    key,
    value: stripOptionalQuotes(trimmed.slice(separatorIndex + 1).trim()),
  };
}

function stripOptionalQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
