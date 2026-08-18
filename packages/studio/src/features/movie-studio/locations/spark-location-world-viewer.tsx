import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/ui/button';
import { loadSparkLocationWorldModules } from './spark-location-world-modules';

interface SparkLocationWorldViewerProps {
  url: string;
}

type ViewerStatus =
  | { kind: 'loading'; progress: number | null }
  | { kind: 'ready' }
  | { kind: 'unsupported' }
  | { kind: 'failed'; message: string };

export function SparkLocationWorldViewer({ url }: SparkLocationWorldViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<ViewerStatus>({
    kind: 'loading',
    progress: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const abortController = new AbortController();
    setStatus({ kind: 'loading', progress: null });

    void initializeSparkViewer({
      canvas,
      url,
      signal: abortController.signal,
      onProgress(progress) {
        if (!disposed) {
          setStatus({ kind: 'loading', progress });
        }
      },
      onReady(resetCamera) {
        if (!disposed) {
          resetCameraRef.current = resetCamera;
          setStatus({ kind: 'ready' });
        }
      },
    }).then((result) => {
      if (disposed) {
        result.cleanup();
        return;
      }
      cleanup = result.cleanup;
    }).catch((error) => {
      if (disposed) {
        return;
      }
      if (error instanceof WebGlUnavailableError) {
        setStatus({ kind: 'unsupported' });
        return;
      }
      setStatus({
        kind: 'failed',
        message: error instanceof Error
          ? error.message
          : 'The 3D World could not be loaded.',
      });
    });

    return () => {
      disposed = true;
      abortController.abort();
      resetCameraRef.current = null;
      cleanup?.();
    };
  }, [attempt, url]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  return (
    <div className='relative h-full min-h-[420px] overflow-hidden bg-black'>
      <canvas
        key={`${url}:${attempt}`}
        ref={canvasRef}
        className='block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
        tabIndex={0}
        aria-label='3D World viewer'
      />
      {status.kind === 'loading' ? (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground backdrop-blur-sm'>
          {status.progress === null
            ? 'Loading 3D World...'
            : `Loading 3D World... ${Math.round(status.progress * 100)}%`}
        </div>
      ) : null}
      {status.kind === 'unsupported' ? (
        <ViewerMessage message='WebGL is unavailable, so this 3D World cannot be displayed.' />
      ) : null}
      {status.kind === 'failed' ? (
        <ViewerMessage message={status.message} actionLabel='Retry' onAction={retry} />
      ) : null}
      {status.kind === 'ready' ? (
        <div className='absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs text-white/80'>
          <span>Drag to orbit · Scroll to zoom · Focus and use WASD to move</span>
          <Button
            type='button'
            size='sm'
            variant='secondary'
            onClick={() => resetCameraRef.current?.()}
          >
            <RotateCcw className='mr-1.5 size-3.5' aria-hidden='true' />
            Reset camera
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ViewerMessage({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className='absolute inset-0 flex items-center justify-center bg-background px-8 text-center'>
      <div className='max-w-md space-y-4'>
        <p className='text-sm text-muted-foreground'>{message}</p>
        {actionLabel && onAction ? (
          <Button type='button' variant='outline' onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

async function initializeSparkViewer(input: {
  canvas: HTMLCanvasElement;
  url: string;
  signal: AbortSignal;
  onProgress(progress: number | null): void;
  onReady(resetCamera: () => void): void;
}): Promise<{ cleanup(): void }> {
  const { THREE, sparkModule, controlsModule } =
    await loadSparkLocationWorldModules();
  if (input.signal.aborted) {
    throw viewerAbortError();
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 10_000);
  let renderer: import('three').WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: input.canvas,
      antialias: false,
    });
  } catch (error) {
    if (isWebGlContextCreationError(error)) {
      throw new WebGlUnavailableError();
    }
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  resizeRenderer({ canvas: input.canvas, camera, renderer });
  const spark = new sparkModule.SparkRenderer({ renderer });
  scene.add(spark);
  const splat = new sparkModule.SplatMesh({
    url: input.url,
    lod: true,
    onProgress(event) {
      input.onProgress(event.lengthComputable && event.total > 0
        ? event.loaded / event.total
        : null);
    },
  });
  // SPZ camera space is inverted relative to Three's Y-up world space.
  // Rotate around X so floors stay below the camera and reset remains upright.
  splat.quaternion.set(1, 0, 0, 0);
  scene.add(splat);
  const controls = new controlsModule.OrbitControls(camera, input.canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  const pressedKeys = new Set<string>();
  const onKeyDown = (event: KeyboardEvent) => {
    if (document.activeElement === input.canvas) {
      pressedKeys.add(event.code);
    }
  };
  const onKeyUp = (event: KeyboardEvent) => pressedKeys.delete(event.code);
  const clearKeys = () => pressedKeys.clear();
  input.canvas.addEventListener('keydown', onKeyDown);
  input.canvas.addEventListener('keyup', onKeyUp);
  input.canvas.addEventListener('blur', clearKeys);
  const resizeObserver = new ResizeObserver(() => {
    resizeRenderer({ canvas: input.canvas, camera, renderer });
  });
  resizeObserver.observe(input.canvas);
  let animationFrame = 0;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    input.canvas.removeEventListener('keydown', onKeyDown);
    input.canvas.removeEventListener('keyup', onKeyUp);
    input.canvas.removeEventListener('blur', clearKeys);
    pressedKeys.clear();
    controls.dispose();
    scene.remove(splat);
    scene.remove(spark);
    splat.dispose();
    spark.dispose();
    renderer.dispose();
  };
  const resetCamera = () => frameSplat({ THREE, camera, controls, splat });
  try {
    await abortable(splat.initialized, input.signal);
    resetCamera();
    input.onReady(resetCamera);
  } catch (error) {
    cleanup();
    throw error;
  }

  let lastFrameTime = performance.now();
  const render = (time: number) => {
    const deltaSeconds = Math.min((time - lastFrameTime) / 1000, 0.1);
    lastFrameTime = time;
    updateFocusedKeyboardMovement({
      THREE,
      camera,
      controls,
      pressedKeys,
      deltaSeconds,
    });
    controls.update();
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(render);
  };
  animationFrame = requestAnimationFrame(render);
  return { cleanup };
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    throw viewerAbortError();
  }
  let rejectAborted: ((reason: Error) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = reject;
  });
  const onAbort = () => rejectAborted?.(viewerAbortError());
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function viewerAbortError(): Error {
  const error = new Error('Viewer initialization cancelled.');
  error.name = 'AbortError';
  return error;
}

function isWebGlContextCreationError(error: unknown): boolean {
  return error instanceof Error
    && error.message.includes('Error creating WebGL context');
}

function resizeRenderer(input: {
  canvas: HTMLCanvasElement;
  camera: import('three').PerspectiveCamera;
  renderer: import('three').WebGLRenderer;
}) {
  const width = Math.max(1, input.canvas.clientWidth);
  const height = Math.max(1, input.canvas.clientHeight);
  input.renderer.setSize(width, height, false);
  input.camera.aspect = width / height;
  input.camera.updateProjectionMatrix();
}

function frameSplat(input: {
  THREE: typeof import('three');
  camera: import('three').PerspectiveCamera;
  controls: import('three/addons/controls/OrbitControls.js').OrbitControls;
  splat: import('@sparkjsdev/spark').SplatMesh;
}) {
  input.splat.updateWorldMatrix(true, false);
  const box = input.splat.getBoundingBox().applyMatrix4(input.splat.matrixWorld);
  const center = box.getCenter(new input.THREE.Vector3());
  const size = box.getSize(new input.THREE.Vector3());
  if (!center.toArray().every(Number.isFinite) || !size.toArray().every(Number.isFinite)) {
    input.controls.target.set(0, 0, 0);
    input.camera.position.set(0, 1, 3);
    input.camera.updateProjectionMatrix();
    input.controls.update();
    return;
  }
  const radius = Math.max(size.length() * 0.5, 1);
  input.controls.target.copy(center);
  input.camera.position.copy(center).add(new input.THREE.Vector3(0, radius * 0.35, radius * 2.2));
  input.camera.near = Math.max(radius / 10_000, 0.001);
  input.camera.far = Math.max(radius * 100, 1_000);
  input.camera.updateProjectionMatrix();
  input.controls.update();
}

function updateFocusedKeyboardMovement(input: {
  THREE: typeof import('three');
  camera: import('three').PerspectiveCamera;
  controls: import('three/addons/controls/OrbitControls.js').OrbitControls;
  pressedKeys: Set<string>;
  deltaSeconds: number;
}) {
  if (input.pressedKeys.size === 0) {
    return;
  }
  const forward = new input.THREE.Vector3();
  input.camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new input.THREE.Vector3().crossVectors(
    forward,
    input.camera.up
  ).normalize();
  const movement = new input.THREE.Vector3();
  if (input.pressedKeys.has('KeyW')) movement.add(forward);
  if (input.pressedKeys.has('KeyS')) movement.sub(forward);
  if (input.pressedKeys.has('KeyD')) movement.add(right);
  if (input.pressedKeys.has('KeyA')) movement.sub(right);
  if (movement.lengthSq() === 0) {
    return;
  }
  const distance = Math.max(
    input.camera.position.distanceTo(input.controls.target) * 0.8,
    0.5
  ) * input.deltaSeconds;
  movement.normalize().multiplyScalar(distance);
  input.camera.position.add(movement);
  input.controls.target.add(movement);
}

class WebGlUnavailableError extends Error {}
