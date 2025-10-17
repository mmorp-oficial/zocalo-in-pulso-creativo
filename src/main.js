import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";

// ============================================================================
// INITIALIZATION
// ============================================================================

const app = document.getElementById("app");
const W = window.innerWidth;
const H = window.innerHeight;

// Scene & Renderer
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

// ============================================================================
// LOADING SCREEN
// ============================================================================

const loadingScreen = document.createElement("div");
loadingScreen.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  transition: opacity 0.5s ease;
`;

const spinner = document.createElement("div");
spinner.style.cssText = `
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
`;

const loadingText = document.createElement("div");
loadingText.textContent = "CAMMARQ";
loadingText.style.cssText = `
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
  font-family: system-ui, -apple-system, sans-serif;
  letter-spacing: 4px;
  margin-top: 24px;
`;

const loadingSubtext = document.createElement("div");
loadingSubtext.textContent = "Construyendo el Futuro";
loadingSubtext.style.cssText = `
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 400;
  font-family: system-ui, -apple-system, sans-serif;
  letter-spacing: 1px;
  margin-top: 8px;
`;

// Add spinner animation
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

loadingScreen.appendChild(spinner);
loadingScreen.appendChild(loadingText);
loadingScreen.appendChild(loadingSubtext);
document.body.appendChild(loadingScreen);

// Loading manager
let assetsToLoad = 0;
let assetsLoaded = 0;

function incrementAssetsToLoad() {
  assetsToLoad++;
}

function incrementAssetsLoaded() {
  assetsLoaded++;
  if (assetsLoaded >= assetsToLoad) {
    hideLoadingScreen();
  }
}

function hideLoadingScreen() {
  loadingScreen.style.opacity = "0";
  setTimeout(() => {
    loadingScreen.remove();
  }, 500);
}

// ============================================================================
// SKY (360 PANORAMA)
// ============================================================================

incrementAssetsToLoad();
const skyLoader = new THREE.TextureLoader();
skyLoader.load(
  "/panos/panoramaSky.png",
  (pano) => {
    pano.colorSpace = THREE.SRGBColorSpace;
    pano.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = pano;
    incrementAssetsLoaded();
  },
  undefined,
  (err) => {
    console.warn("Sky load error:", err);
    incrementAssetsLoaded();
  }
);

// ============================================================================
// LIGHTS
// ============================================================================

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// ============================================================================
// GROUND (PBR TEXTURED PLANE)
// ============================================================================

const TILES_U = 64;
const TILES_V = 64;

function prepareTexture(texture, useSRGB = false) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(TILES_U, TILES_V);
  if (useSRGB) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.anisotropy = 8;
  return texture;
}

const textureLoader = new THREE.TextureLoader();

// Load ground textures
incrementAssetsToLoad();
incrementAssetsToLoad();
incrementAssetsToLoad();
incrementAssetsToLoad();

const albedoMap = textureLoader.load("/textures/zocalo_Albedo.webp", () =>
  incrementAssetsLoaded()
);
const normalMap = textureLoader.load("/textures/zocalo_Normal.webp", () =>
  incrementAssetsLoaded()
);
const roughnessMap = textureLoader.load("/textures/zocalo_Roughness.webp", () =>
  incrementAssetsLoaded()
);
const aoMap = textureLoader.load("/textures/zocalo_AO.webp", () =>
  incrementAssetsLoaded()
);

prepareTexture(albedoMap, true);
prepareTexture(normalMap, false);
prepareTexture(roughnessMap, false);
prepareTexture(aoMap, false);

const groundGeometry = new THREE.PlaneGeometry(20, 20);
groundGeometry.setAttribute(
  "uv2",
  new THREE.BufferAttribute(groundGeometry.attributes.uv.array, 2)
);

const groundMaterial = new THREE.MeshStandardMaterial({
  map: albedoMap,
  normalMap: normalMap,
  roughnessMap: roughnessMap,
  aoMap: aoMap,
  metalness: 0.0,
  roughness: 1.0,
  normalScale: new THREE.Vector2(1, 1),
  aoMapIntensity: 0.8,
});

const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ============================================================================
// PLAYER & CAMERA
// ============================================================================

const EYE_HEIGHT = 0.15;
const MOVE_SPEED = 1.0;
const MOUSE_SENSITIVITY = 0.002;
const MOVEMENT_BOUNDS = { x: 4, z: 3 };

const player = new THREE.Object3D();
player.position.set(0, 0, 1.5);

const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
camera.position.set(0, EYE_HEIGHT, 0);
player.add(camera);
scene.add(player);

// ============================================================================
// GAUSSIAN SPLATS
// ============================================================================

// Main splat
incrementAssetsToLoad();
const mainSplat = new SplatMesh({
  url: "/splats/splatZocalo.ply",
  onLoad: () => {
    console.log("Main splat loaded");
    incrementAssetsLoaded();
  },
});
mainSplat.position.set(0, 0.25, 0);
mainSplat.rotateX(Math.PI);
scene.add(mainSplat);

// Helper function to place splats in quadrants
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

  positions.forEach((pos, idx) => {
    incrementAssetsToLoad();
    const mesh = new SplatMesh({
      url,
      onLoad: () => {
        console.log(`Splat loaded: ${url} [${idx}]`);
        incrementAssetsLoaded();
      },
    });
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rotateXPi) mesh.rotateX(Math.PI);
    if (scale !== 1) mesh.scale.setScalar(scale);
    group.add(mesh);
  });

  scene.add(group);
  return group;
}

// Pegaso splats (4 copies)
const pegasoGroup = placeSplatInQuadrants({
  url: "/splats/PegasoPLY.ply",
});

// Banca splats (2 copies)
incrementAssetsToLoad();
const bancaA = new SplatMesh({
  url: "/splats/bancaPLY.ply",
  onLoad: () => {
    console.log("Banca A loaded");
    incrementAssetsLoaded();
  },
});
bancaA.position.set(0, 0.25, 0.0);
bancaA.rotateX(Math.PI);
scene.add(bancaA);

incrementAssetsToLoad();
const bancaB = new SplatMesh({
  url: "/splats/bancaPLY.ply",
  onLoad: () => {
    console.log("Banca B loaded");
    incrementAssetsLoaded();
  },
});
bancaB.position.copy(bancaA.position);
bancaB.rotateZ(Math.PI);
scene.add(bancaB);

// ============================================================================
// POINTER LOCK CONTROLS
// ============================================================================

let isLocked = false;
let yaw = 0;
let pitch = 0;

// Logo overlay
const logoOverlay = document.createElement("img");
logoOverlay.src = "/textures/logo.png";
logoOverlay.style.cssText = `
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  height: 120px;
  z-index: 1000;
  user-select: none;
  pointer-events: none;
`;
document.body.appendChild(logoOverlay);

const controlsHint = document.createElement("div");
controlsHint.textContent =
  "Click to move • WASD/Arrows + Mouse • Esc to unlock";
controlsHint.style.cssText = `
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 16px;
  padding: 8px 12px;
  background: rgba(20, 24, 28, 0.7);
  color: #fff;
  border-radius: 8px;
  font: 12px/1.2 system-ui, sans-serif;
  z-index: 1000;
  user-select: none;
`;
document.body.appendChild(controlsHint);

renderer.domElement.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  controlsHint.style.display = isLocked ? "none" : "block";
});

document.addEventListener("mousemove", (e) => {
  if (!isLocked) return;

  yaw -= e.movementX * MOUSE_SENSITIVITY;
  pitch -= e.movementY * MOUSE_SENSITIVITY;

  // Clamp pitch to prevent flipping
  const pitchLimit = Math.PI / 2 - 0.01;
  pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));

  player.rotation.y = yaw;
  camera.rotation.x = pitch;
});

// ============================================================================
// KEYBOARD MOVEMENT
// ============================================================================

const keys = { forward: false, backward: false, left: false, right: false };

function handleKeyEvent(code, pressed) {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      keys.forward = pressed;
      break;
    case "KeyS":
    case "ArrowDown":
      keys.backward = pressed;
      break;
    case "KeyA":
    case "ArrowLeft":
      keys.left = pressed;
      break;
    case "KeyD":
    case "ArrowRight":
      keys.right = pressed;
      break;
  }
}

document.addEventListener("keydown", (e) => handleKeyEvent(e.code, true));
document.addEventListener("keyup", (e) => handleKeyEvent(e.code, false));

// ============================================================================
// MOVEMENT UPDATE
// ============================================================================

const clock = new THREE.Clock();
const worldUp = new THREE.Vector3(0, 1, 0);
const moveDirection = new THREE.Vector3();

function updateMovement(deltaTime) {
  moveDirection.set(0, 0, 0);

  if (keys.forward) moveDirection.z -= 1;
  if (keys.backward) moveDirection.z += 1;
  if (keys.left) moveDirection.x -= 1;
  if (keys.right) moveDirection.x += 1;

  if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize();
    moveDirection.applyAxisAngle(worldUp, player.rotation.y);
    player.position.addScaledVector(moveDirection, MOVE_SPEED * deltaTime);

    // Keep player on horizontal plane (no vertical movement)
    player.position.y = 0;
  }

  // Apply movement bounds
  player.position.x = Math.max(
    -MOVEMENT_BOUNDS.x,
    Math.min(MOVEMENT_BOUNDS.x, player.position.x)
  );
  player.position.z = Math.max(
    -MOVEMENT_BOUNDS.x,
    Math.min(MOVEMENT_BOUNDS.z, player.position.z)
  );
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  updateMovement(deltaTime);
  renderer.render(scene, camera);
}

animate();

// ============================================================================
// WINDOW RESIZE
// ============================================================================

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
