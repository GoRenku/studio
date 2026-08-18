// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SparkLocationWorldViewer } from './spark-location-world-viewer';

const viewerMocks = vi.hoisted(() => {
  const rendererConstructors = vi.fn();
  const rendererDispose = vi.fn();
  const rendererForceContextLoss = vi.fn();
  const splatDispose = vi.fn();
  const sparkDispose = vi.fn();
  const controlsDispose = vi.fn();
  const splatApplyMatrix4 = vi.fn();
  const splatQuaternionSet = vi.fn();
  const splatFailures: Error[] = [];

  class Vector3 {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0
    ) {}

    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }

    copy(other: Vector3) {
      return this.set(other.x, other.y, other.z);
    }

    add(other: Vector3) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }

    sub(other: Vector3) {
      this.x -= other.x;
      this.y -= other.y;
      this.z -= other.z;
      return this;
    }

    crossVectors() {
      return this;
    }

    normalize() {
      return this;
    }

    multiplyScalar(scalar: number) {
      this.x *= scalar;
      this.y *= scalar;
      this.z *= scalar;
      return this;
    }

    length() {
      return Math.hypot(this.x, this.y, this.z);
    }

    lengthSq() {
      return (this.x ** 2) + (this.y ** 2) + (this.z ** 2);
    }

    distanceTo(other: Vector3) {
      return Math.hypot(
        this.x - other.x,
        this.y - other.y,
        this.z - other.z
      );
    }

    toArray() {
      return [this.x, this.y, this.z];
    }
  }

  class Scene {
    background: unknown;
    add = vi.fn();
    remove = vi.fn();
  }

  class PerspectiveCamera {
    aspect = 1;
    far = 1_000;
    near = 0.01;
    position = new Vector3();
    up = new Vector3(0, 1, 0);
    updateProjectionMatrix = vi.fn();

    getWorldDirection(target: Vector3) {
      return target.set(0, 0, -1);
    }
  }

  class WebGLRenderer {
    dispose = rendererDispose;
    forceContextLoss = rendererForceContextLoss;
    render = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();

    constructor(parameters: Record<string, unknown>) {
      rendererConstructors(parameters);
    }
  }

  class SparkRenderer {
    dispose = sparkDispose;
  }

  class SplatMesh {
    dispose = splatDispose;
    initialized: Promise<void>;
    matrixWorld = {};
    quaternion = { set: splatQuaternionSet };
    updateWorldMatrix = vi.fn();

    constructor() {
      const failure = splatFailures.shift();
      this.initialized = failure
        ? Promise.reject(failure)
        : Promise.resolve();
    }

    getBoundingBox() {
      const box = {
        applyMatrix4: (matrix: unknown) => {
          splatApplyMatrix4(matrix);
          return box;
        },
        getCenter: (target: Vector3) => target.set(0, 0, 0),
        getSize: (target: Vector3) => target.set(2, 2, 2),
      };
      return box;
    }
  }

  class OrbitControls {
    dampingFactor = 0;
    enableDamping = false;
    target = new Vector3();
    dispose = controlsDispose;
    update = vi.fn();
  }

  return {
    controlsDispose,
    rendererConstructors,
    rendererDispose,
    rendererForceContextLoss,
    sparkDispose,
    splatApplyMatrix4,
    splatDispose,
    splatFailures,
    splatQuaternionSet,
    modules: {
      THREE: {
        Color: class Color {},
        PerspectiveCamera,
        Scene,
        Vector3,
        WebGLRenderer,
      },
      sparkModule: { SparkRenderer, SplatMesh },
      controlsModule: { OrbitControls },
    },
  };
});

vi.mock('./spark-location-world-modules', () => ({
  loadSparkLocationWorldModules: vi.fn(async () => viewerMocks.modules),
}));

describe('SparkLocationWorldViewer', () => {
  beforeEach(() => {
    viewerMocks.rendererConstructors.mockReset();
    viewerMocks.rendererDispose.mockReset();
    viewerMocks.rendererForceContextLoss.mockReset();
    viewerMocks.splatDispose.mockReset();
    viewerMocks.sparkDispose.mockReset();
    viewerMocks.controlsDispose.mockReset();
    viewerMocks.splatApplyMatrix4.mockReset();
    viewerMocks.splatQuaternionSet.mockReset();
    viewerMocks.splatFailures.length = 0;
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('initializes once with a renderer-owned context under StrictMode', async () => {
    render(
      <StrictMode>
        <SparkLocationWorldViewer url='/council-chamber.spz' />
      </StrictMode>
    );

    expect(await screen.findByText(/Drag to orbit/)).toBeTruthy();
    expect(viewerMocks.rendererConstructors).toHaveBeenCalledTimes(1);
    expect(viewerMocks.rendererConstructors).toHaveBeenCalledWith(
      expect.objectContaining({ antialias: false })
    );
    expect(viewerMocks.rendererConstructors.mock.calls[0]?.[0]).not.toHaveProperty(
      'context'
    );
    expect(viewerMocks.splatQuaternionSet).toHaveBeenCalledWith(1, 0, 0, 0);
    expect(viewerMocks.splatApplyMatrix4).toHaveBeenCalled();
  });

  it('uses a fresh canvas on retry without forcibly losing WebGL context', async () => {
    viewerMocks.splatFailures.push(new Error('Temporary world load failure'));
    render(<SparkLocationWorldViewer url='/council-chamber.spz' />);

    expect(await screen.findByText('Temporary world load failure')).toBeTruthy();
    const firstCanvas = screen.getByLabelText('3D World viewer');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText(/Drag to orbit/)).toBeTruthy();
    const secondCanvas = screen.getByLabelText('3D World viewer');
    expect(secondCanvas).not.toBe(firstCanvas);
    expect(viewerMocks.rendererConstructors).toHaveBeenCalledTimes(2);
    for (const [parameters] of viewerMocks.rendererConstructors.mock.calls) {
      expect(parameters).toEqual(expect.objectContaining({ antialias: false }));
      expect(parameters).not.toHaveProperty('context');
    }
    await waitFor(() => {
      expect(viewerMocks.rendererDispose).toHaveBeenCalled();
    });
    expect(viewerMocks.rendererForceContextLoss).not.toHaveBeenCalled();
  });
});
