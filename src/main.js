import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";

const app = document.getElementById("app");
const W = window.innerWidth;
const H = window.innerHeight;

// --- Scene & Renderer ---
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

// --- Sky (equirectangular 360) ---
const loader = new THREE.TextureLoader();
loader.load(
  "/panos/panoramaSky.png",
  (pano) => {
    // correct color and mapping for a pano
    pano.colorSpace = THREE.SRGBColorSpace;
    pano.mapping = THREE.EquirectangularReflectionMapping;

    // set as background
    scene.background = pano;
  },
  undefined,
  (err) => console.warn("Sky load error:", err)
);

// Make sure your renderer is in sRGB for correct colors:
renderer.outputColorSpace = THREE.SRGBColorSpace;

// --- Lights ---
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 5);
scene.add(dir);

// --- Ground PBR (albedo + normal + roughness + AO), tiled 6x6 ---
const texLoader = new THREE.TextureLoader();
const TILES_U = 64,
  TILES_V = 64;

// helper: wrap + repeat + (optional) sRGB
function prepTexture(tex, srgb = false) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(TILES_U, TILES_V);
  if (srgb) {
    if ("outputColorSpace" in renderer) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
  }
  return tex;
}

// load textures
const albedo = prepTexture(
  texLoader.load("/textures/zocalo_Albedo.webp"),
  true
); // color → sRGB
const normal = prepTexture(texLoader.load("/textures/zocalo_Normal.webp")); // linear
const rough = prepTexture(texLoader.load("/textures/zocalo_Roughness.webp")); // linear
const ao = prepTexture(texLoader.load("/textures/zocalo_AO.webp")); // linear

// geometry (uv + uv2 needed for AO)
const groundGeo = new THREE.PlaneGeometry(20, 20);

// copy uv to uv2 so aoMap works
groundGeo.setAttribute(
  "uv2",
  new THREE.BufferAttribute(groundGeo.attributes.uv.array, 2)
);

const groundMat = new THREE.MeshStandardMaterial({
  map: albedo,
  normalMap: normal,
  roughnessMap: rough,
  aoMap: ao,
  metalness: 0.0,
  roughness: 1.0, // multiplier with roughnessMap
  normalScale: new THREE.Vector2(1, 1),
  aoMapIntensity: 0.8, // tweak 0–1 if AO feels heavy
});

const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Optional: better glancing-angle quality
albedo.anisotropy = normal.anisotropy = rough.anisotropy = ao.anisotropy = 8;

// --- Player (XZ-only movement) + Camera ---
const EYE_HEIGHT = 0.15; // meters-ish
const player = new THREE.Object3D();
player.position.set(0, 0, 1.5); // start position on the plane

const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
camera.position.set(0, EYE_HEIGHT, 0); // eye height relative to player
player.add(camera);
scene.add(player);

// --- SparkJS Splat ---
const splat = new SplatMesh({
  url: "/splats/splatZocalo.ply", // put file under /public/splats/
  onLoad: () => console.log("Splat ready"),
});
splat.position.set(0, 0.25, 0);
splat.rotateX(Math.PI);
scene.add(splat);

// ---- Quadrant placer for SparkJS splats ----
function placeSplatInQuadrants({
  url,
  distance = 2,
  y = 0,
  rotateXPi = true,
  scale = 0.75,
}) {
  const group = new THREE.Group();
  const positions = [
    [+distance + 1, y, +distance], // Q1
    [-distance - 1, y, +distance], // Q2
    [-distance - 1, y, -distance], // Q3
    [+distance + 1, y, -distance], // Q4
  ];
  positions.forEach((p, i) => {
    const m = new SplatMesh({
      url,
      onLoad: () => console.log("Splat ready:", url, "idx", i),
    });
    m.position.set(p[0], p[1], p[2]);
    if (rotateXPi) m.rotateX(Math.PI); // keep if your splats appear upside down
    if (scale !== 1) m.scale.setScalar(scale);
    group.add(m);
  });
  scene.add(group);
  return group;
}

// ---------- MODE A: four copies per file (8 total) ----------
const pegasoSet = placeSplatInQuadrants({
  url: "/splats/PegasoPLY.ply",
});

//

const bancaA = new SplatMesh({ url: "/splats/bancaPLY.ply" });
bancaA.position.set(0, 0.25, 0.0);
bancaA.rotateX(Math.PI);
scene.add(bancaA);

const bancaB = new SplatMesh({ url: "/splats/bancaPLY.ply" });
bancaB.position.copy(bancaA.position);
bancaB.rotateZ(Math.PI);
scene.add(bancaB);

//

// --- Pointer Lock (mouse look) ---
let isLocked = false;
let yaw = 0; // horizontal rotation
let pitch = 0; // vertical rotation (camera only; movement stays flat)

// helper: show a small hint until locked
const hint = document.createElement("div");
hint.textContent = "Click to move • WASD/Arrows + Mouse • Esc to unlock";
hint.style.cssText =
  "position:fixed;left:50%;transform:translateX(-50%);bottom:16px;" +
  "padding:8px 12px;background:rgba(20,24,28,.7);color:#fff;border-radius:8px;" +
  "font:12px/1.2 system-ui, sans-serif;z-index:1000;user-select:none";
document.body.appendChild(hint);

renderer.domElement.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  hint.style.display = isLocked ? "none" : "block";
});

document.addEventListener("mousemove", (e) => {
  if (!isLocked) return;
  const sensitivity = 0.002; // lower = slower
  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  // clamp pitch so you can't flip over
  const lim = Math.PI / 2 - 0.01;
  pitch = Math.max(-lim, Math.min(lim, pitch));

  // apply rotations: player yaw; camera pitch
  player.rotation.y = yaw;
  camera.rotation.x = pitch;
});

// --- Keyboard movement (XZ only) ---
const keys = { f: false, b: false, l: false, r: false };
const setKey = (code, pressed) => {
  if (code === "KeyW" || code === "ArrowUp") keys.f = pressed;
  if (code === "KeyS" || code === "ArrowDown") keys.b = pressed;
  if (code === "KeyA" || code === "ArrowLeft") keys.l = pressed;
  if (code === "KeyD" || code === "ArrowRight") keys.r = pressed;
};
document.addEventListener("keydown", (e) => setKey(e.code, true));
document.addEventListener("keyup", (e) => setKey(e.code, false));

// --- Movement update ---
const clock = new THREE.Clock();
const SPEED = 1.0; // units/second
const worldUp = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();

function updateMovement(dt) {
  tmp.set(0, 0, 0);
  if (keys.f) tmp.z -= 1;
  if (keys.b) tmp.z += 1;
  if (keys.l) tmp.x -= 1;
  if (keys.r) tmp.x += 1;

  if (tmp.lengthSq() > 0) {
    tmp.normalize();

    // rotate by yaw only so movement stays horizontal
    tmp.applyAxisAngle(worldUp, player.rotation.y);

    // scale by speed and delta
    player.position.addScaledVector(tmp, SPEED * dt);

    // keep on the plane (no vertical movement)
    player.position.y = 0;
  }

  // optional simple bounds so you don't walk off the demo ground
  const limit = 4;
  player.position.x = Math.max(-limit, Math.min(limit, player.position.x));
  player.position.z = Math.max(-limit, Math.min(3, player.position.z));
}

// --- Animate ---
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  updateMovement(dt);
  renderer.render(scene, camera);
}
animate();

// --- Resize ---
window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
