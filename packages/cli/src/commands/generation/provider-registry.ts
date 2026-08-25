import {
  createElevenLabsMediaProvider,
  createFalMediaProvider,
  createMediaEngine,
  createReplicateMediaProvider,
  createWaveSpeedMediaProvider,
  type MediaEngine,
} from '@gorenku/studio-engines';

export function createRenkuMediaEngine(): MediaEngine {
  return createMediaEngine([
    createFalMediaProvider(),
    createReplicateMediaProvider(),
    createWaveSpeedMediaProvider(),
    createElevenLabsMediaProvider(),
  ]);
}
