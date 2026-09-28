// Draw ledger: every draw call in a frame, attributed to the object that made it.
//
// renderer.info.render.calls says how many draws a frame spent; this says on
// what. It wraps the two renderer methods every draw and every frame pass
// through — renderBufferDirect (scene, shadow, cube probe and post quads all
// land here) and info.reset (main.js calls it once, at the top of each frame) —
// and counts a row only when the call actually moved the counter, so an
// instanced mesh at count 0 or a culled draw range is not booked as a draw.
//
// Capture-only: main.js binds it behind ?capture=1. Play never runs the wrapper.
const PASSES = [
  ['shadow', (scene) => scene === null],
  ['mirror', (scene, object, target) => target?.isWebGLCubeRenderTarget === true],
  ['post', (scene, object) => scene === object],
  ['main', () => true],
];

function pathOf(object) {
  const steps = [];
  for (let o = object; o.parent; o = o.parent) steps.unshift(o.parent.children.indexOf(o));
  return steps.join('/');
}

function describe(renderer, scene, object, material) {
  const target = renderer.getRenderTarget();
  const [pass] = PASSES.find(([, test]) => test(scene, object, target));
  return {
    pass,
    path: pathOf(object),
    name: object.name,
    type: object.type,
    material: material.type,
    color: material.color ? material.color.getHexString() : null,
    verts: object.geometry?.attributes.position?.count ?? 0,
    instances: object.isInstancedMesh ? object.count : null,
    castShadow: object.castShadow,
    transparent: material.transparent,
    opacity: material.opacity,
  };
}

// Returns ledger(frames): resolves with one array of rows per whole frame,
// starting at the next frame boundary.
export function drawLedger(renderer) {
  const direct = renderer.renderBufferDirect;
  const reset = renderer.info.reset;
  let job = null;
  renderer.info.reset = function ledgerReset() {
    reset.call(this);
    if (!job) return;
    if (job.current) job.frames.push(job.current);
    if (job.frames.length >= job.want) {
      job.resolve(job.frames);
      job = null;
      return;
    }
    job.current = [];
  };
  renderer.renderBufferDirect = function ledgerDirect(camera, scene, geometry, material, object, group) {
    const before = renderer.info.render.calls;
    direct.call(this, camera, scene, geometry, material, object, group);
    if (job?.current && renderer.info.render.calls > before) {
      job.current.push(describe(renderer, scene, object, material));
    }
  };
  return (want = 1) => new Promise((resolve) => {
    job = { want, frames: [], current: null, resolve };
  });
}
