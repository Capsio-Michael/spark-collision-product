import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const SPARKY_STATES = Object.freeze(['idle', 'reading', 'thinking', 'insight', 'complete']);
export const SPARKY_PALETTES = Object.freeze({
  leaf: { body: '#82c852', belly: '#eee9c8' },
  mint: { body: '#7bcdb5', belly: '#f1eed9' },
  sky: { body: '#82bde1', belly: '#f4f0d9' },
  lilac: { body: '#b5a2d7', belly: '#f3edda' },
});

const MODEL_URL = new URL('./assets/sparky.glb', import.meta.url).href;
const FALLBACK_URL = new URL('./assets/sparky-fallback.png', import.meta.url).href;
const VIEWS = Object.freeze({ front: [0, 2.25, 5.5], side: [5.5, 2.25, 0], back: [0, 2.25, -5.5] });

/** Loads a real GLB. All motion is JS node animation; the GLB contains no clips. */
export async function mountSparky(host, { state = 'idle', color = 'leaf', onReady = () => {} } = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('A DOM host is required');
  if (!SPARKY_STATES.includes(state)) throw new TypeError('Unknown Sparky state');
  host.classList.add('sparky-3d-host');
  host.replaceChildren();
  const status = document.createElement('span');
  status.className = 'sparky-3d-status';
  status.setAttribute('role', 'status');
  status.textContent = '正在读取本地 3D 模型';
  host.append(status);
  let renderer, controls, resizeObserver, raf = 0, model, rig, camera, scene;
  let currentState = state;
  let changedAt = performance.now() / 1000;
  let palette = color;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let destroyed = false;

  function fallback(message) {
    status.textContent = message;
    const image = document.createElement('img');
    image.className = 'sparky-3d-fallback';
    image.alt = 'Sparky 静态 3D 风格参考图；当前浏览器未显示可旋转模型';
    image.src = FALLBACK_URL;
    host.append(image);
    return { kind: 'static-fallback', setState, setColor, setView, dispose };
  }

  function setState(next) {
    if (!SPARKY_STATES.includes(next)) throw new TypeError('Unknown Sparky state');
    currentState = next;
    changedAt = performance.now() / 1000;
  }

  function setColor(next) {
    const values = typeof next === 'string' ? SPARKY_PALETTES[next] : next;
    if (!values || !/^#[0-9a-f]{6}$/i.test(values.body) || !/^#[0-9a-f]{6}$/i.test(values.belly)) {
      throw new TypeError('Color needs {body, belly} hex values or a palette key');
    }
    palette = next;
    if (rig) {
      rig.skin.color.set(values.body);
      rig.shade.color.set(values.body).multiplyScalar(0.77);
      rig.belly.color.set(values.belly);
    }
  }

  function setView(view) {
    if (!Object.hasOwn(VIEWS, view)) throw new TypeError('Unknown view');
    if (!camera || !controls) return;
    camera.position.set(...VIEWS[view]);
    controls.target.set(0, 1.55, 0);
    controls.update();
  }

  function dispose() {
    destroyed = true;
    cancelAnimationFrame(raf);
    resizeObserver?.disconnect();
    controls?.dispose();
    if (model) {
      const geometries = new Set(), materials = new Set();
      model.traverse((item) => {
        if (item.isMesh) { geometries.add(item.geometry); materials.add(item.material); }
      });
      geometries.forEach(item => item.dispose());
      materials.forEach(item => item.dispose());
    }
    renderer?.dispose();
    host.replaceChildren();
  }

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return fallback('WebGL 不可用，显示静态参考图');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.65;
  host.prepend(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xe7f8f1, 0x60766c, 2.3));
  const key = new THREE.DirectionalLight(0xfff4d9, 3.0);
  key.position.set(-3, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9bdeba, 1.35);
  rim.position.set(4, 3, -5);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshBasicMaterial({ color: 0x33584a, transparent: true, opacity: .18, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  scene.add(ground);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = !reduceMotion.matches;
  controls.minDistance = 3.4;
  controls.maxDistance = 8.5;
  controls.maxPolarAngle = Math.PI * .72;
  controls.minPolarAngle = Math.PI * .18;
  setView('front');

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  try {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    if (destroyed) return { kind: 'disposed', setState, setColor, setView, dispose };
    model = gltf.scene;
    scene.add(model);
    const get = name => model.getObjectByName(name);
    rig = {
      body: get('BodyBreath'), head: get('HeadRig'), leftEye: get('Eye_L_Rig'),
      rightEye: get('Eye_R_Rig'), rightArm: get('Arm_R_Rig'), spark: get('ForeheadSpark'),
    };
    if (Object.values(rig).slice(0, 6).some(item => !item)) throw new Error('Required model rig node missing');
    const materials = new Map();
    model.traverse(item => { if (item.isMesh) materials.set(item.material.name, item.material); });
    rig.skin = materials.get('Skin');
    rig.shade = materials.get('SkinShade');
    rig.belly = materials.get('Belly');
    rig.gold = materials.get('GoldSpark');
    if ([rig.skin, rig.shade, rig.belly, rig.gold].some(item => !item)) throw new Error('Required model material missing');
    setColor(palette);
    status.textContent = '真实 GLB 已加载，可拖动旋转';
    onReady({ model, nodes: rig, triangles: model.userData.triangles ?? null });
  } catch (error) {
    resizeObserver.disconnect();
    renderer.domElement.remove();
    controls.dispose();
    renderer.dispose();
    return fallback(`3D 模型加载失败，显示静态参考图：${error.message}`);
  }

  function tick(ms) {
    if (destroyed) return;
    const t = ms / 1000;
    const elapsed = Math.max(0, t - changedAt);
    const motion = !reduceMotion.matches;
    rig.body.scale.y = motion ? 1 + .012 * Math.sin(t * 2.2) : 1;
    const blinkPhase = t % 4.7;
    const blink = motion && blinkPhase > 4.48 ? 1 - .91 * Math.sin(Math.PI * (blinkPhase - 4.48) / .22) : 1;
    rig.leftEye.scale.y = rig.rightEye.scale.y = blink;
    rig.head.rotation.set(0, 0, 0);
    rig.rightArm.rotation.z = 0;
    rig.gold.emissiveIntensity = .55;
    if (currentState === 'reading') rig.head.rotation.x = motion ? .08 + .018 * Math.sin(t * 1.3) : .08;
    if (currentState === 'thinking') rig.head.rotation.z = motion ? .11 + .055 * Math.sin(t * 1.8) : .11;
    if (currentState === 'insight') {
      rig.head.rotation.x = motion ? -.15 * Math.min(1, elapsed / .32) : -.15;
      rig.gold.emissiveIntensity = motion ? 1.2 + .6 * Math.sin(t * 8) ** 2 : 1.3;
    }
    if (currentState === 'complete') {
      rig.head.rotation.x = motion ? .12 * Math.sin(Math.min(elapsed, 1.1) * 13) * Math.max(0, 1 - elapsed / 1.1) : 0;
      rig.rightArm.rotation.z = motion ? .24 * Math.sin(Math.min(elapsed, 1.4) * 15) * Math.max(0, 1 - elapsed / 1.4) : 0;
    }
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return { kind: 'real-3d', model, setState, setColor, setView, dispose };
}
