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
const motionModel = 'fal-ai/xai/grok-imagine-video/image-to-video';
const motionDurationSeconds = 4;
const referenceAspectRatio = '4:3';
const sheetAspectRatio = '4:3';
const tileAspectRatio = '16:9';

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
  asset('subject-over-the-shoulder', 'Subject Framing', 'Over-the-Shoulder', 'still', 'Foreground shoulder frames the main performer across the room.'),
  asset('subject-over-the-hip', 'Subject Framing', 'Over-the-Hip', 'still', 'Foreground hip-level silhouette frames the performer beyond.'),
  asset('subject-point-of-view', 'Subject Framing', 'Point of View', 'still', 'A subjective view looking toward hands and the performer ahead.'),
  asset('subject-insert', 'Subject Framing', 'Insert', 'still', 'A close detail insert of a hand placing a key on a pale ochre counter.'),
  asset('subject-reaction', 'Subject Framing', 'Reaction', 'still', 'The performer reacting subtly to something off frame.'),
  asset('angle-eye-level', 'Camera Angle / Height', 'Eye Level', 'still', 'The camera is level with the performer\'s eyes, neutral and calm.'),
  asset('angle-low-angle', 'Camera Angle / Height', 'Low Angle', 'still', 'A low camera looks upward at the performer and tall pastel hotel architecture.'),
  asset('angle-high-angle', 'Camera Angle / Height', 'High Angle', 'still', 'A high camera looks down at the performer in the geometric room.'),
  asset('angle-overhead', 'Camera Angle / Height', 'Overhead', 'still', 'A direct overhead bird\'s-eye view of the performer and patterned floor.'),
  asset('angle-shoulder-level', 'Camera Angle / Height', 'Shoulder Level', 'still', 'The lens sits at shoulder height, framing posture and upper body.'),
  asset('angle-hip-level', 'Camera Angle / Height', 'Hip Level', 'still', 'The lens sits at hip height, emphasizing wardrobe and stance.'),
  asset('angle-knee-level', 'Camera Angle / Height', 'Knee Level', 'still', 'The lens sits at knee height, showing legs, floor pattern, and vertical set lines.'),
  asset('angle-ground-level', 'Camera Angle / Height', 'Ground Level', 'still', 'The lens sits almost on the floor, looking across polished tile toward the performer.'),
  asset('movement-static', 'Camera Motion', 'Static', 'still', 'A locked-off symmetrical frame with no implied movement.'),
  asset('movement-pan', 'Camera Motion', 'Pan', 'motion', 'A horizontal camera pan across the pastel Mustard Lobby room while the performer remains poised.', 'Smooth horizontal pan from left to right across the set, preserving the original composition and color palette.'),
  asset('movement-tilt', 'Camera Motion', 'Tilt', 'motion', 'A camera tilt from the performer up to the ornate ceiling and back.', 'Smooth vertical tilt upward from the performer to the architecture, then settling gently.'),
  asset('movement-swish-pan', 'Camera Motion', 'Swish Pan', 'motion', 'A fast horizontal whip-pan with controlled motion blur between matching set details.', 'Fast horizontal swish pan with tasteful motion blur, ending on the performer.'),
  asset('movement-swish-tilt', 'Camera Motion', 'Swish Tilt', 'motion', 'A fast vertical whip-tilt with controlled blur from floor to subject.', 'Fast vertical swish tilt with controlled motion blur, landing on the performer.'),
  asset('movement-tracking', 'Camera Motion', 'Tracking', 'motion', 'A lateral tracking move alongside the performer walking through the set.', 'Gentle sideways tracking move following the performer, stable and cinematic.'),
  asset('movement-push-in', 'Camera Motion', 'Push-In', 'motion', 'A slow push-in toward the performer, turning a medium shot into a close view.', 'Slow dolly push-in toward the performer, subtle and steady.'),
  asset('movement-pull-out', 'Camera Motion', 'Pull-Out', 'motion', 'A slow pull-out revealing the larger pastel hotel room around the performer.', 'Slow dolly pull-out revealing more of the room, stable and elegant.'),
  asset('movement-zoom', 'Camera Motion', 'Zoom', 'motion', 'An optical zoom changes the crop while the camera stays centered and fixed.', 'Optical zoom inward while the camera position remains fixed, no dolly movement.'),
  asset('rig-sticks', 'Rig / Mechanism', 'Sticks', 'still', 'A locked tripod setup implied by a stable, formal composition.'),
  asset('rig-hand-held', 'Rig / Mechanism', 'Hand-Held', 'still', 'A slightly intimate handheld-feeling frame with human looseness but no chaos.'),
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

async function generateMotion(options) {
  const source = ASSETS.find((entry) => entry.id === options.asset);
  if (!source || source.kind !== 'motion') {
    throw new Error(`Unknown motion asset. Use one of: ${motionIds().join(', ')}`);
  }
  await prepareFolders();
  const imagePath = path.join(outputRoot, 'images', `${source.id}.png`);
  if (!await fileExists(imagePath)) {
    const sourceSheet = sheetForAsset(source.id);
    throw new Error(`${relativeOutputPath(imagePath)} is required before motion generation. Generate and slice ${sourceSheet.title} first with: sheet --name ${sourceSheet.name} --yes`);
  }
  const motionPath = path.join(outputRoot, 'motion', `${source.id}.mp4`);
  if (!options.force && await fileExists(motionPath)) {
    throw new Error(`${relativeOutputPath(motionPath)} already exists. Pass --force to replace it.`);
  }
  const fal = await loadFal();
  const imageUrl = await uploadPng(fal, imagePath);
  const prompt = buildMotionPrompt(source);
  const result = await fal.subscribe(motionModel, {
    input: {
      prompt,
      image_url: imageUrl,
      duration: motionDurationSeconds,
      aspect_ratio: tileAspectRatio,
      resolution: '720p',
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
    status: 'review_required',
  });
  await writeManifest(manifest);
  console.log(relativeOutputPath(motionPath));
}

function printPlan() {
  console.log('Shot Design asset generation plan');
  console.log('Estimated provider cost: $0.15 reference + $0.15 per 4-cell sheet + $0.20 per 4s motion preview.');
  console.log('1. reference --yes');
  for (let index = 0; index < sheetCells.length; index += 1) {
    const selectedSheet = SHEETS[index];
    console.log(`${index + 2}. sheet --number ${selectedSheet.number} --yes`);
    console.log(`   name: ${selectedSheet.name}`);
    console.log(`   title: ${selectedSheet.title}`);
    console.log(`   ${sheetCells[index].map((cell) => cell.id).join(', ')}`);
  }
  console.log('Motion ids:');
  console.log(motionIds().join(', '));
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
  return [
    `Create sheet ${selectedSheet.number} (${selectedSheet.title}) of a Renku Studio camera-design UI tile set.`,
    'Use the provided reference image as binding source for character identity, hairstyle, wardrobe, lack of accessories, environment, pastel color palette, lighting, lens feeling, and production design.',
    'The new sheet must look like it came from the exact same origin as the reference image. Keep the same woman, same center-parted low bun, same cream and pale mint-sage dress, and no added jewelry, bags, jackets, or changing accessories.',
    'Create one 4:3 sheet containing exactly four separate 16:9 cinematic stills in a clean 2x2 arrangement. Each still should be easy to crop as a standalone 16:9 image.',
    'It is acceptable for the 4:3 sheet to have tasteful parchment margins and gutters around the 16:9 stills. Do not stretch cells or make square cells.',
    'Use the pastel Mustard Lobby palette: parchment cream, pale mint-sage, pastel ochre or antique gold architecture, muted terracotta materials, tiny oxblood details, and warm ink contrast. Avoid saturated yellow and pink-dominant scenes.',
    'No text, captions, numbers, watermarks, UI controls, crop marks, or labels inside any cell.',
    'Cells in reading order:',
    ...cells.map((cell, index) => `${index + 1}. ${cell.label}: ${cell.description}`),
  ].join('\n');
}

function buildMotionPrompt(source) {
  return [
    source.motionPrompt,
    'Create a short elegant camera-design preview from this still image.',
    'Preserve the original subject identity, set, color palette, wardrobe, and composition.',
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

function sheetForAsset(assetId) {
  const index = sheetCells.findIndex((cells) => cells.some((cell) => cell.id === assetId));
  if (index === -1) {
    throw new Error(`Could not find sheet for asset ${assetId}.`);
  }
  return SHEETS[index];
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
    parsed.motion ??= [];
    return parsed;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {
        generatedBy: 'generate-assets',
        outputRoot: path.relative(repoRoot, outputRoot),
        sheets: [],
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
