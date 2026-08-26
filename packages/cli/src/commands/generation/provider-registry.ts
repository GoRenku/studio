import {
  createElevenLabsMediaProvider,
  createFalMediaProvider,
  createMediaEngine,
  createPikaMediaProvider,
  createReplicateMediaProvider,
  createWaveSpeedMediaProvider,
  type MediaEngine,
} from '@gorenku/studio-engines';

export function createRenkuMediaEngine(): MediaEngine {
  return createMediaEngine([
    createFalMediaProvider(),
    createPikaMediaProvider(),
    createReplicateMediaProvider(),
    createWaveSpeedMediaProvider(),
    createElevenLabsMediaProvider(),
  ]);
}
