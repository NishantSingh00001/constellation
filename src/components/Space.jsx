import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mulberry32, normal } from "../../shared/random.js";

const SCALE = 1.25;
const MAX_SEGS = 8;

const vertex = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aDelay;
  attribute float aSeg;
  attribute float aIndex;
  uniform float uProgress;
  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uSize;
  uniform float uHover;
  uniform float uSegAlpha[${MAX_SEGS}];
  varying vec3 vColor;
  varying float vAlpha;
  float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }
  void main() {
    float p = easeOut(clamp(uProgress * 1.5 - aDelay * 0.5, 0.0, 1.0));
    vec3 pos = mix(aStart, position, p);
    pos += 0.012 * vec3(sin(uTime * 0.7 + aDelay * 40.0), cos(uTime * 0.6 + aDelay * 33.0), sin(uTime * 0.5 + aDelay * 21.0));
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float hovered = 1.0 - step(0.5, abs(aIndex - uHover));
    int s = int(aSeg + 0.5);
    float segA = uSegAlpha[s];
    gl_PointSize = uSize * aSize * (1.0 + hovered * 2.2) * uPixelRatio * (9.0 / -mv.z);
    vColor = mix(aColor, vec3(1.0), hovered * 0.5);
    vAlpha = segA * (0.25 + 0.75 * p) + hovered;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.22, 0.0, d);
    float glow = exp(-d * d * 14.0);
    float a = (core * 0.9 + glow * 0.55) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.55 + core * 0.8), a);
  }
`;

/** Prim's MST over a handful of points: gives each segment a "constellation" figure. */
function mstEdges(pts) {
  const n = pts.length;
  const inTree = new Array(n).fill(false);
  const best = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  best[0] = 0;
  const edges = [];
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i;
    inTree[u] = true;
    if (parent[u] >= 0) edges.push([parent[u], u]);
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const d = pts[u].distanceToSquared(pts[v]);
      if (d < best[v]) { best[v] = d; parent[v] = u; }
    }
  }
  return edges;
}

/** Synthetic clusters for the landing-page hero. */
export function heroData(count = 2600, colors) {
  const rand = mulberry32(7);
  const centers = [
    [1.6, 1.7, 1.4], [1.2, 1.3, -1.3], [0.6, 0.5, 0.9], [-0.3, 0.1, 1.5],
    [-0.1, -0.3, -1.2], [-1.2, -1.1, 0.8], [-1.7, -1.4, -0.6], [0.4, -1.3, -0.2],
  ];
  const positions = new Float32Array(count * 3);
  const seg = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const s = Math.floor(rand() * centers.length);
    seg[i] = s;
    const sd = 0.28 + (s % 3) * 0.05;
    positions[i * 3] = centers[s][0] + normal(rand) * sd;
    positions[i * 3 + 1] = centers[s][1] + normal(rand) * sd;
    positions[i * 3 + 2] = centers[s][2] + normal(rand) * sd;
  }
  return { positions, seg, colors };
}

/**
 * props:
 *  positions Float32Array(n*3), seg ArrayLike(n), colors string[]
 *  mode "hero" | "run"
 *  highlight number|null, hidden Set<number>
 *  labels string[] (segment names; run mode)
 *  onHover(index|null, {x,y}), onSelect(index)
 */
export default function Space({ positions, seg, colors, mode = "run", highlight = null, hidden, labels, onHover, onSelect, className = "space" }) {
  const hostRef = useRef(null);
  const stateRef = useRef({});
  const propsRef = useRef({});
  propsRef.current = { highlight, hidden, onHover, onSelect };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !positions) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const isHero = mode === "hero";
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      host.dataset.nowebgl = "1";
      return undefined;
    }
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(isHero ? 40 : 42, 1, 0.1, 200);
    camera.position.set(isHero ? 6.2 : 7.4, isHero ? 3.2 : 4.4, isHero ? 7.6 : 8.6);
    const group = new THREE.Group();
    scene.add(group);

    // --- customers as points ---
    const n = positions.length / 3;
    const rand = mulberry32(11);
    const pos = new Float32Array(n * 3);
    const start = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const delay = new Float32Array(n);
    const segA = new Float32Array(n);
    const idx = new Float32Array(n);
    const palette = colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 3; t++) pos[i * 3 + t] = positions[i * 3 + t] * SCALE;
      // start on a wide shell so the intro reads as stars gathering
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, r = 9 + rand() * 6;
      const s = Math.sqrt(1 - u * u);
      start[i * 3] = r * s * Math.cos(th);
      start[i * 3 + 1] = r * u;
      start[i * 3 + 2] = r * s * Math.sin(th);
      const c = palette[seg[i] % palette.length];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = 0.55 + rand() * 0.9;
      delay[i] = rand();
      segA[i] = Math.min(seg[i], MAX_SEGS - 1);
      idx[i] = i;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
    geo.setAttribute("aSeg", new THREE.BufferAttribute(segA, 1));
    geo.setAttribute("aIndex", new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const segAlpha = new Array(MAX_SEGS).fill(1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: reduce ? 1 : 0 },
        uPixelRatio: { value: pr },
        uTime: { value: 0 },
        uSize: { value: n > 6000 ? 4.2 : 5.2 },
        uHover: { value: -1 },
        uSegAlpha: { value: segAlpha },
      },
    });
    const points = new THREE.Points(geo, mat);
    group.add(points);

    // --- centroids + constellation lines ---
    const k = colors.length;
    const sums = Array.from({ length: k }, () => new THREE.Vector3());
    const counts = new Array(k).fill(0);
    const members = Array.from({ length: k }, () => []);
    for (let i = 0; i < n; i++) {
      const s = seg[i];
      sums[s].x += pos[i * 3]; sums[s].y += pos[i * 3 + 1]; sums[s].z += pos[i * 3 + 2];
      counts[s]++;
      members[s].push(i);
    }
    const centroids = sums.map((v, s) => (counts[s] ? v.divideScalar(counts[s]) : v));
    const lineGroups = [];
    for (let s = 0; s < k; s++) {
      if (!counts[s]) { lineGroups.push(null); continue; }
      const pick = [centroids[s].clone()];
      const m = members[s];
      // pick a few members near the core so the figure stays inside the cluster
      const cand = [];
      for (let t = 0; t < Math.min(60, m.length); t++) {
        const i = m[Math.floor(rand() * m.length)];
        cand.push(new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
      }
      cand.sort((a, b) => a.distanceToSquared(centroids[s]) - b.distanceToSquared(centroids[s]));
      pick.push(...cand.slice(0, isHero ? 7 : 9));
      const edges = mstEdges(pick);
      const arr = new Float32Array(edges.length * 6);
      edges.forEach(([a, b], e) => {
        arr.set([pick[a].x, pick[a].y, pick[a].z, pick[b].x, pick[b].y, pick[b].z], e * 6);
      });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const lm = new THREE.LineBasicMaterial({ color: palette[s], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.LineSegments(lg, lm);
      group.add(line);
      lineGroups.push(line);
    }
    // centroid stars
    const cGeo = new THREE.BufferGeometry();
    const cPos = new Float32Array(k * 3), cCol = new Float32Array(k * 3), cSize = new Float32Array(k), cDelay = new Float32Array(k), cSeg = new Float32Array(k), cIdx = new Float32Array(k).fill(-9);
    centroids.forEach((c, s) => {
      cPos.set([c.x, c.y, c.z], s * 3);
      cCol.set([palette[s].r, palette[s].g, palette[s].b], s * 3);
      cSize[s] = 5.5; cDelay[s] = 0.9; cSeg[s] = s;
    });
    cGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3));
    cGeo.setAttribute("aStart", new THREE.BufferAttribute(cPos.slice(), 3));
    cGeo.setAttribute("aColor", new THREE.BufferAttribute(cCol, 3));
    cGeo.setAttribute("aSize", new THREE.BufferAttribute(cSize, 1));
    cGeo.setAttribute("aDelay", new THREE.BufferAttribute(cDelay, 1));
    cGeo.setAttribute("aSeg", new THREE.BufferAttribute(cSeg, 1));
    cGeo.setAttribute("aIndex", new THREE.BufferAttribute(cIdx, 1));
    const cMat = mat.clone();
    cMat.uniforms = THREE.UniformsUtils.clone(mat.uniforms);
    cMat.uniforms.uSegAlpha.value = segAlpha;
    const cPoints = new THREE.Points(cGeo, cMat);
    group.add(cPoints);

    // --- background stars ---
    const bgN = isHero ? 1400 : 900;
    const bg = new Float32Array(bgN * 3);
    for (let i = 0; i < bgN; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, r = 30 + rand() * 40;
      const s = Math.sqrt(1 - u * u);
      bg.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bg, 3));
    const bgMat = new THREE.PointsMaterial({ color: 0x9aa4c8, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false });
    const bgPoints = new THREE.Points(bgGeo, bgMat);
    scene.add(bgPoints);

    // --- axes (run mode) ---
    const axisLabels = [];
    if (!isHero) {
      const L = 3.4;
      const o = new THREE.Vector3(-L, -L, -L);
      const axes = [
        { to: new THREE.Vector3(L, -L, -L), text: "More orders →" },
        { to: new THREE.Vector3(-L, L, -L), text: "Higher spend ↑" },
        { to: new THREE.Vector3(-L, -L, L), text: "More recent →" },
      ];
      const arr = new Float32Array(axes.length * 6);
      axes.forEach((a, i) => arr.set([o.x, o.y, o.z, a.to.x, a.to.y, a.to.z], i * 6));
      const ag = new THREE.BufferGeometry();
      ag.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      group.add(new THREE.LineSegments(ag, new THREE.LineBasicMaterial({ color: 0x8b9dff, transparent: true, opacity: 0.22 })));
      const grid = new THREE.GridHelper(L * 2, 12, 0x2a2f4a, 0x161a2c);
      grid.position.y = -L;
      grid.material.transparent = true;
      grid.material.opacity = 0.45;
      group.add(grid);
      for (const a of axes) {
        const el = document.createElement("div");
        el.className = "space__axis";
        el.textContent = a.text;
        host.appendChild(el);
        axisLabels.push({ el, pos: a.to.clone().lerp(o, -0.06) });
      }
    }
    const segLabels = [];
    if (!isHero && labels) {
      labels.forEach((name, s) => {
        if (!counts[s]) return;
        const el = document.createElement("div");
        el.className = "space__axis";
        el.style.color = "#eef0f7";
        el.style.fontSize = "0.66rem";
        el.style.opacity = "0";
        el.style.transition = "opacity .4s";
        el.textContent = name;
        host.appendChild(el);
        segLabels.push({ el, pos: centroids[s].clone().add(new THREE.Vector3(0, 0.42, 0)), s });
      });
    }

    // --- controls ---
    let controls = null;
    if (!isHero) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enablePan = false;
      controls.autoRotate = !reduce;
      controls.autoRotateSpeed = 0.55;
      controls.target.set(0, 0, 0);
      controls.addEventListener("start", () => { controls.autoRotate = false; });
    }
    // Frame the data: orbit around its centre, far enough back to fit it.
    const center = new THREE.Vector3();
    for (let i = 0; i < n; i++) { center.x += pos[i * 3] / n; center.y += pos[i * 3 + 1] / n; center.z += pos[i * 3 + 2] / n; }
    let radius = 0;
    const tmp = new THREE.Vector3();
    const dists = [];
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 4000))) dists.push(tmp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).distanceTo(center));
    dists.sort((a, b) => a - b);
    radius = dists[Math.floor(dists.length * 0.98)] || 3;
    const fitDistance = () => Math.max(5, (radius * 1.15) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect ** 0.5));
    const frameCamera = () => {
      if (isHero) { camera.lookAt(0, 0, 0); return; }
      controls.target.copy(center);
      const dir = new THREE.Vector3(0.62, 0.42, 0.66).normalize();
      camera.position.copy(center).addScaledVector(dir, fitDistance());
      controls.minDistance = fitDistance() * 0.45;
      controls.maxDistance = fitDistance() * 2;
      controls.update();
    };

    // --- sizing ---
    let width = 1, height = 1;
    const resize = () => {
      width = host.clientWidth || 1;
      height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (isHero) {
        const wide = width > 900;
        group.position.set(wide ? 2.4 : 0, wide ? 0 : 0.4, wide ? 0 : -1.5);
        camera.fov = wide ? 40 : 52;
      }
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    frameCamera();

    // --- hover / select ---
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.09;
    const mouse = new THREE.Vector2(9, 9);
    let pointer = null;
    let hovered = -1;
    let downAt = null;
    const onMove = (e) => {
      const rect = host.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      mouse.set((pointer.x / rect.width) * 2 - 1, -(pointer.y / rect.height) * 2 + 1);
    };
    const onLeave = () => { pointer = null; mouse.set(9, 9); };
    const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onUp = (e) => {
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 && hovered >= 0) propsRef.current.onSelect?.(hovered);
      downAt = null;
    };
    const heroMouse = { x: 0, y: 0 };
    const onHeroMove = (e) => {
      heroMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      heroMouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (isHero) window.addEventListener("pointermove", onHeroMove, { passive: true });
    else {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("pointerdown", onDown);
      host.addEventListener("pointerup", onUp);
    }

    // --- visibility-aware loop ---
    let visible = true;
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });
    io.observe(host);
    const clock = new THREE.Clock();
    const introDur = reduce ? 0 : isHero ? 2.8 : 2.2;
    let t0 = null;
    let raf = 0;
    const v = new THREE.Vector3();
    let frame = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      if (t0 === null) t0 = time;
      const prog = introDur ? Math.min(1, (time - t0) / introDur) : 1;
      mat.uniforms.uProgress.value = prog;
      mat.uniforms.uTime.value = reduce ? 0 : time;
      cMat.uniforms.uProgress.value = prog;
      cMat.uniforms.uTime.value = mat.uniforms.uTime.value;

      // segment visibility (smoothly animated)
      const { highlight: hl, hidden: hid } = propsRef.current;
      for (let s = 0; s < MAX_SEGS; s++) {
        const target = hid && hid.has(s) ? 0 : hl == null || hl === s ? 1 : 0.1;
        segAlpha[s] += (target - segAlpha[s]) * Math.min(1, dt * 8);
      }
      const lineFade = Math.max(0, (prog - 0.75) / 0.25);
      lineGroups.forEach((l, s) => { if (l) l.material.opacity = 0.42 * lineFade * segAlpha[s] * (hl === s ? 1.8 : 1); });

      if (isHero) {
        group.rotation.y += reduce ? 0 : dt * 0.07;
        group.rotation.x += ((heroMouse.y * 0.12) - group.rotation.x) * 0.03;
        camera.position.x += ((6.2 + heroMouse.x * 0.8) - camera.position.x) * 0.03;
        camera.lookAt(group.position.x * 0.55, 0, 0);
      } else {
        controls.update();
      }
      bgPoints.rotation.y += dt * 0.004;

      // hover picking every other frame
      if (!isHero && prog >= 1 && (frame++ & 1) === 0) {
        let hit = -1;
        if (pointer) {
          raycaster.setFromCamera(mouse, camera);
          const hits = raycaster.intersectObject(points);
          let bestD = Infinity;
          for (const h of hits) {
            const s = seg[h.index];
            if (segAlpha[Math.min(s, MAX_SEGS - 1)] < 0.5) continue;
            if (h.distanceToRay < bestD) { bestD = h.distanceToRay; hit = h.index; }
          }
        }
        if (hit !== hovered) {
          hovered = hit;
          mat.uniforms.uHover.value = hit;
          host.style.cursor = hit >= 0 ? "pointer" : "";
        }
        propsRef.current.onHover?.(hovered >= 0 ? hovered : null, pointer);
      }

      renderer.render(scene, camera);

      // project HTML labels
      const place = (item, alpha) => {
        v.copy(item.pos).applyMatrix4(group.matrixWorld).project(camera);
        let x = (v.x * 0.5 + 0.5) * width;
        const y = (-v.y * 0.5 + 0.5) * height;
        const half = (item.w ??= item.el.offsetWidth) / 2 + 8;
        x = Math.min(width - half, Math.max(half, x));
        item.el.style.left = `${x}px`;
        item.el.style.top = `${y}px`;
        if (alpha != null) item.el.style.opacity = String(alpha);
      };
      axisLabels.forEach((a) => place(a, prog));
      segLabels.forEach((l) => place(l, prog < 1 ? 0 : hl == null ? 0.75 * segAlpha[l.s] : hl === l.s ? 1 : 0.08));
    };
    tick();

    stateRef.current = { renderer };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onHeroMove);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      controls?.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      [...axisLabels, ...segLabels].forEach((a) => a.el.remove());
    };
    // Rebuild only when the data itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, seg, colors, mode, labels]);

  return <div ref={hostRef} className={className} aria-label={mode === "hero" ? undefined : "3D map of customers. Drag to rotate, scroll to zoom."} role={mode === "hero" ? "presentation" : "img"} />;
}
