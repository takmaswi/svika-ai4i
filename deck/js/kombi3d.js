/* The one 3D object in the deck: the Meshy Hiace, compressed by
   tools/deck/compress-kombi.mjs, lit warm per the design system. Marigold key,
   char shadows, paper or char ground per theme. Colour override per scene is
   deck freedom only (SHOWCASE-DECK-PLAN.md kombi colour ruling); the app's
   map marker law is untouched.
   If WebGL init fails (or ?nowebgl forces it), the layer swaps to the
   pre rendered poster and the deck carries on. */

import * as THREE from "three";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/libs/meshopt_decoder.module.js";

const COLORS = {
  white: 0xffffff,
  marigold: 0xf5b301,
  forest: 0x1f4d2e,
};

export async function initKombi({ forceFallback = false, reduced = false } = {}) {
  const layer = document.getElementById("kombi-layer");
  const posterEl = document.getElementById("kombi-fallback");

  function fallbackApi() {
    layer.classList.add("is-fallback");
    return {
      mode: "fallback",
      show(opts = {}) {
        layer.classList.add("is-live");
        posterEl.src =
          opts.theme === "day" ? "assets/kombi-poster-day.webp" : "assets/kombi-poster-night.webp";
      },
      hide() { layer.classList.remove("is-live"); },
      setTheme(theme) {
        posterEl.src =
          theme === "day" ? "assets/kombi-poster-day.webp" : "assets/kombi-poster-night.webp";
      },
      setColor() {},
      spin() {},
      entrance() {},
      setFloat() {},
      fps: () => 0,
    };
  }

  if (forceFallback) return fallbackApi();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // 1.25 caps the canvas near 2K on high DPR laptops; the van is soft
    // studio lit, so extra pixels buy nothing and cost the 60fps gate.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  } catch (_e) {
    return fallbackApi();
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 1.35, 7.2);
  camera.lookAt(0, 0.55, 0);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  layer.insertBefore(renderer.domElement, posterEl);

  // Warm key from high front left, marigold rim from behind, low char fill.
  const key = new THREE.DirectionalLight(0xffe2a8, 2.6);
  key.position.set(-3.4, 5.2, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  key.shadow.radius = 6;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf5b301, 1.5);
  rim.position.set(3.6, 2.2, -4.4);
  scene.add(rim);
  const fill = new THREE.AmbientLight(0x8a9188, 0.55);
  scene.add(fill);

  // Ground: theme coloured disc plus a char tinted contact shadow.
  // Unlit ground in the exact canvas colour per theme, so the horizon
  // dissolves into the page and only the shadow grounds the van.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(40, 48),
    new THREE.MeshBasicMaterial({ color: 0x161d18, toneMapped: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  scene.add(ground);
  const shadowCatcher = new THREE.Mesh(
    new THREE.CircleGeometry(40, 48),
    new THREE.ShadowMaterial({ color: 0x161d18, opacity: 0.4 }),
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.001;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  const group = new THREE.Group();
  scene.add(group);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let bodyMaterials = [];
  try {
    const gltf = await loader.loadAsync("assets/kombi.glb");
    const model = gltf.scene;
    // Normalise: centre on origin, sit on the ground, face the camera three
    // quarter. Meshy exports vary in scale, so measure and fit.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = 3.4 / Math.max(size.x, size.z);
    model.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(model);
    const center = box2.getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.position.y = -box2.min.y; // sit on the ground plane
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        if (o.material) {
          // Meshy exports metallic=1 which reads coal black under a plain
          // key light; the van is painted steel, not chrome.
          o.material.metalness = 0.08;
          o.material.roughness = 0.55;
          bodyMaterials.push(o.material);
        }
      }
    });
    group.add(model);
  } catch (_e) {
    renderer.dispose();
    renderer.domElement.remove();
    return fallbackApi();
  }

  // ---------- Render loop with an FPS meter for the gate report ----------
  let visible = false;
  const frameTimes = [];
  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!visible) { last = now; return; }
    frameTimes.push(now - last);
    if (frameTimes.length > 90) frameTimes.shift();
    last = now;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  function resize() {
    const w = layer.clientWidth, h = layer.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  let floatTween = null;

  const api = {
    mode: "webgl",
    group,
    show(opts = {}) {
      visible = true;
      layer.classList.add("is-live");
      if (opts.theme) api.setTheme(opts.theme);
      if (opts.color) api.setColor(opts.color);
    },
    hide() {
      visible = false;
      layer.classList.remove("is-live");
    },
    setTheme(theme) {
      const day = theme === "day";
      ground.material.color.set(day ? 0xffffff : 0x161d18);
      fill.intensity = day ? 1.15 : 0.55;
      key.intensity = day ? 2.9 : 2.6;
      rim.intensity = day ? 0.9 : 1.5;
      shadowCatcher.material.opacity = day ? 0.22 : 0.4;
    },
    setColor(name) {
      const hex = COLORS[name] ?? COLORS.white;
      bodyMaterials.forEach((m) => m.color.setHex(hex));
    },
    // Scene entrance: the kombi arrives, it does not appear. The model's
    // nose sits at rotation.y = PI - 0.62 three quarter; offsets are baked
    // into the defaults so scenes speak in story terms.
    entrance({ duration = 2.2, from = Math.PI - 2.6, to = Math.PI - 0.62, scale = 1 } = {}) {
      group.rotation.y = from;
      group.position.x = 1.6;
      group.scale.setScalar(scale * 0.86);
      return gsap.timeline()
        .to(group.rotation, { y: to, duration, ease: "power3.out" }, 0)
        .to(group.position, { x: 0, duration, ease: "power3.out" }, 0)
        .to(group.scale, { x: scale, y: scale, z: scale, duration, ease: "power3.out" }, 0);
    },
    spin(delta, duration = 1.4) {
      return gsap.to(group.rotation, { y: group.rotation.y + delta, duration, ease: "power2.inOut" });
    },
    setFloat(on) {
      if (floatTween) { floatTween.kill(); floatTween = null; }
      group.position.y = 0;
      if (on && !reduced) {
        // The kombi bob, 2.4s, straight from the motion table.
        floatTween = gsap.to(group.position, {
          y: 0.035, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut",
        });
      }
    },
    fps() {
      if (!frameTimes.length) return 0;
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      return Math.round(1000 / avg);
    },
  };

  return api;
}
