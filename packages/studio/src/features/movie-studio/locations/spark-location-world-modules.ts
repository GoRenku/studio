export async function loadSparkLocationWorldModules() {
  const [THREE, sparkModule, controlsModule] = await Promise.all([
    import('three'),
    import('@sparkjsdev/spark'),
    import('three/addons/controls/OrbitControls.js'),
  ]);
  return { THREE, sparkModule, controlsModule };
}
