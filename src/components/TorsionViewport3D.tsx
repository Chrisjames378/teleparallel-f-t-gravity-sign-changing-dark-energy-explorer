import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { CosmologyParams, EpochEvaluation } from '../physics/cosmology';

interface TorsionViewport3DProps {
  epoch: EpochEvaluation;
  params: CosmologyParams;
}

// Pre-allocated math helpers for zero-GC render loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

interface ClusterSeed {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  tint: number;
}

function generateCosmicWebSeeds(count: number): {
  clusters: ClusterSeed[];
  edges: Array<[number, number]>;
} {
  let seed = 13379;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const clusters: ClusterSeed[] = [];
  for (let i = 0; i < count; i++) {
    const r = 1.4 + Math.pow(rand(), 0.72) * 7.2;
    const theta = rand() * Math.PI * 2;
    const y = (rand() - 0.5) * 3.2;
    clusters.push({
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      size: 0.75 + rand() * 0.75,
      phase: rand() * Math.PI * 2,
      tint: rand(),
    });
  }

  const edges: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = clusters[i].x - clusters[j].x;
      const dy = clusters[i].y - clusters[j].y;
      const dz = clusters[i].z - clusters[j].z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < 5.6 && edges.length < 280) {
        edges.push([i, j]);
      }
    }
  }

  return { clusters, edges };
}

export const TorsionViewport3D: React.FC<TorsionViewport3DProps> = ({ epoch, params }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | 'split'>('3d');
  const [lensingOn, setLensingOn] = useState<boolean>(true);
  const [dockOpen, setDockOpen] = useState<boolean>(true);

  const liveStateRef = useRef({
    epoch,
    params,
    viewMode,
    lensingOn,
    cameraResetRequested: false,
  });

  useEffect(() => {
    liveStateRef.current.epoch = epoch;
    liveStateRef.current.params = params;
    liveStateRef.current.viewMode = viewMode;
    liveStateRef.current.lensingOn = lensingOn;
  }, [epoch, params, viewMode, lensingOn]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07090E');
    scene.fog = new THREE.FogExp2('#07090E', 0.036);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 140);
    camera.position.set(11.5, 7.6, 12.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Procedural Studio Environment Reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // Warm Key + Cool Hemisphere Fill + Rim Light
    const hemiLight = new THREE.HemisphereLight('#38BDF8', '#0F172A', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF3E0', 1.6);
    keyLight.position.set(10, 14, 8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#06B6D4', 1.1);
    rimLight.position.set(-10, 5, -9);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.48;

    let userInteracting = false;
    controls.addEventListener('start', () => {
      userInteracting = true;
    });
    controls.addEventListener('end', () => {
      userInteracting = false;
    });

    // Root Manifold Assembly Group
    const manifoldGroup = new THREE.Group();
    scene.add(manifoldGroup);

    // 1. Deformable Torsion Sheet
    const sheetSegs = 44;
    const sheetGeo = new THREE.PlaneGeometry(18, 18, sheetSegs, sheetSegs);
    sheetGeo.rotateX(-Math.PI / 2);
    const vertCount = sheetGeo.attributes.position.count;
    const baseXZ = new Float32Array(vertCount * 2);
    const sheetColors = new Float32Array(vertCount * 3);
    const posAttr = sheetGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < vertCount; i++) {
      baseXZ[i * 2] = posAttr.getX(i);
      baseXZ[i * 2 + 1] = posAttr.getZ(i);
    }
    sheetGeo.setAttribute('color', new THREE.BufferAttribute(sheetColors, 3));

    const sheetMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.35,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    });
    const sheetMesh = new THREE.Mesh(sheetGeo, sheetMat);
    sheetMesh.position.y = -1.6;
    manifoldGroup.add(sheetMesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: '#1E293B',
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const wireMesh = new THREE.Mesh(sheetGeo, wireMat);
    wireMesh.position.y = -1.58;
    manifoldGroup.add(wireMesh);

    // 2. Composite Central Torsion Reticle Assembly (3 distinct metallic/glass parts)
    const reticleGroup = new THREE.Group();
    reticleGroup.position.y = -0.35;
    manifoldGroup.add(reticleGroup);

    const outerRingGeo = new THREE.TorusGeometry(2.6, 0.045, 16, 72);
    outerRingGeo.rotateX(Math.PI / 2);
    const outerRingMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      metalness: 0.88,
      roughness: 0.18,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    reticleGroup.add(outerRing);

    const innerRingGeo = new THREE.TorusGeometry(1.55, 0.035, 14, 60);
    innerRingGeo.rotateX(Math.PI / 2);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      metalness: 0.9,
      roughness: 0.25,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    reticleGroup.add(innerRing);

    const coreGeo = new THREE.OctahedronGeometry(0.42, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: '#06B6D4',
      metalness: 0.15,
      roughness: 0.12,
      clearcoat: 1.0,
    });
    const coreNode = new THREE.Mesh(coreGeo, coreMat);
    reticleGroup.add(coreNode);

    // 3. Instanced Comoving Galaxy Clusters + Cosmic Web Filaments
    const CLUSTER_COUNT = 136;
    const { clusters, edges } = generateCosmicWebSeeds(CLUSTER_COUNT);

    const clusterGeo = new THREE.IcosahedronGeometry(0.11, 1);
    const clusterMat = new THREE.MeshStandardMaterial({
      color: '#E2E8F0',
      roughness: 0.35,
      metalness: 0.25,
    });
    const clusterInstanced = new THREE.InstancedMesh(clusterGeo, clusterMat, CLUSTER_COUNT);
    clusterInstanced.frustumCulled = false;
    manifoldGroup.add(clusterInstanced);

    const filamentPositions = new Float32Array(edges.length * 6);
    const filamentGeo = new THREE.BufferGeometry();
    filamentGeo.setAttribute('position', new THREE.BufferAttribute(filamentPositions, 3));
    const filamentMat = new THREE.LineBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.26,
    });
    const filamentLines = new THREE.LineSegments(filamentGeo, filamentMat);
    manifoldGroup.add(filamentLines);

    // 4. Instanced Weak Gravitational Lensing Shear Vectors
    const SHEAR_COUNT = 64;
    const shearGeo = new THREE.BoxGeometry(0.55, 0.025, 0.03);
    const shearMat = new THREE.MeshStandardMaterial({
      color: '#C084FC',
      metalness: 0.65,
      roughness: 0.28,
    });
    const shearInstanced = new THREE.InstancedMesh(shearGeo, shearMat, SHEAR_COUNT);
    shearInstanced.frustumCulled = false;
    manifoldGroup.add(shearInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const updateSceneState = (elapsed: number, delta: number) => {
      const st = liveStateRef.current;
      const curEpoch = st.epoch;
      const curParams = st.params;

      // Smoothly interpolate camera preset if mode switched or reset requested
      if (st.cameraResetRequested || (!userInteracting && st.viewMode === 'split')) {
        if (st.viewMode === 'split') {
          _vec3A.set(0.01, 16.5, 0.01);
        } else {
          _vec3A.set(11.5, 7.6, 12.2);
        }
        const dampLambda = isSoftwareGl ? 1.0 : 1 - Math.exp(-5.0 * delta);
        camera.position.lerp(_vec3A, dampLambda);
        controls.target.lerp(_vec3B.set(0, -0.4, 0), dampLambda);
        if (camera.position.distanceTo(_vec3A) < 0.08) {
          st.cameraResetRequested = false;
        }
      }

      // Scale factor expansion visual range (0.55 at z=3 to 1.25 at z=0)
      const comovingScale = 0.55 + 0.7 * curEpoch.a;
      const eosMod = 1 + Math.max(-0.45, Math.min(0.65, -1 - curParams.w0));
      const torsionStrength = Math.min(2.4, (Math.abs(curEpoch.fTRatio) * 2.2 + 0.25) * eosMod);
      const signPolarity = curEpoch.OmegaDE < -0.005 ? -1 : 1;

      // Deform spacetime torsion sheet vertices & colors
      for (let i = 0; i < vertCount; i++) {
        const bx = baseXZ[i * 2];
        const bz = baseXZ[i * 2 + 1];
        const r = Math.sqrt(bx * bx + bz * bz);
        const angle = Math.atan2(bz, bx);
        const twistWave = Math.sin(r * 0.75 - elapsed * 1.1 + angle * 2.0 * signPolarity);
        const wellDepth = -signPolarity * torsionStrength * 1.45 * Math.exp(-r * 0.16);
        const heightY = wellDepth + 0.18 * twistWave * Math.exp(-r * 0.12);
        posAttr.setY(i, heightY);

        if (signPolarity < 0) {
          // Crimson / Amber negative DE regime
          const mix = Math.min(1, Math.abs(curEpoch.OmegaDE) * 1.8);
          _color.setRGB(0.22 + 0.72 * mix, 0.14 + 0.12 * (1 - mix), 0.28 + 0.1 * (1 - mix));
        } else {
          // Cobalt / Laser Cyan positive DE regime
          const mix = Math.min(1, curEpoch.OmegaDE * 1.4);
          _color.setRGB(0.05 + 0.04 * mix, 0.22 + 0.52 * mix, 0.42 + 0.48 * mix);
        }
        sheetColors[i * 3] = _color.r;
        sheetColors[i * 3 + 1] = _color.g;
        sheetColors[i * 3 + 2] = _color.b;
      }
      posAttr.needsUpdate = true;
      (sheetGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      sheetGeo.computeVertexNormals();

      // Update composite central reticle
      const twistRate = 0.25 + 0.35 * curParams.alphaT;
      outerRing.rotation.z = elapsed * twistRate * signPolarity;
      innerRing.rotation.x = Math.sin(elapsed * 0.7) * 0.35 * signPolarity;
      innerRing.rotation.z = -elapsed * twistRate * 1.3;
      coreNode.rotation.y = elapsed * 0.8;
      coreMat.color.set(signPolarity < 0 ? '#F43F5E' : curEpoch.isPole ? '#F59E0B' : '#06B6D4');

      // Update instanced comoving galaxy clusters
      const clusterWorldX = new Float32Array(CLUSTER_COUNT);
      const clusterWorldY = new Float32Array(CLUSTER_COUNT);
      const clusterWorldZ = new Float32Array(CLUSTER_COUNT);

      for (let i = 0; i < CLUSTER_COUNT; i++) {
        const c = clusters[i];
        const r = Math.sqrt(c.x * c.x + c.z * c.z);
        const torsionTwist = signPolarity * torsionStrength * 0.24 * Math.exp(-r * 0.14);
        const cosT = Math.cos(torsionTwist);
        const sinT = Math.sin(torsionTwist);

        const wx = (c.x * cosT - c.z * sinT) * comovingScale;
        const wz = (c.x * sinT + c.z * cosT) * comovingScale;
        const wy = c.y * comovingScale + Math.sin(elapsed * 0.9 + c.phase) * 0.06;

        clusterWorldX[i] = wx;
        clusterWorldY[i] = wy;
        clusterWorldZ[i] = wz;

        _vec3A.set(wx, wy, wz);
        _euler.set(c.phase, elapsed * 0.3 + c.phase, 0);
        _quat.setFromEuler(_euler);
        _scale.setScalar(c.size * (0.78 + 0.35 * curEpoch.a));
        _mat4.compose(_vec3A, _quat, _scale);
        clusterInstanced.setMatrixAt(i, _mat4);

        if (signPolarity < 0) {
          _color.setHSL(0.95 - c.tint * 0.08, 0.8, 0.65);
        } else {
          _color.setHSL(0.52 + c.tint * 0.1, 0.85, 0.68);
        }
        clusterInstanced.setColorAt(i, _color);
      }
      clusterInstanced.instanceMatrix.needsUpdate = true;
      if (clusterInstanced.instanceColor) clusterInstanced.instanceColor.needsUpdate = true;

      // Update cosmic web filaments
      const fPos = filamentGeo.attributes.position as THREE.BufferAttribute;
      for (let e = 0; e < edges.length; e++) {
        const [aIdx, bIdx] = edges[e];
        fPos.setXYZ(e * 2, clusterWorldX[aIdx], clusterWorldY[aIdx], clusterWorldZ[aIdx]);
        fPos.setXYZ(e * 2 + 1, clusterWorldX[bIdx], clusterWorldY[bIdx], clusterWorldZ[bIdx]);
      }
      fPos.needsUpdate = true;
      filamentMat.color.set(signPolarity < 0 ? '#FB7185' : '#38BDF8');

      // Update Weak Lensing Shear Vectors
      shearInstanced.visible = st.lensingOn;
      if (st.lensingOn) {
        const shearAmp = 0.7 + Math.min(1.1, Math.abs(curEpoch.fTRatio) * 1.4);
        for (let i = 0; i < SHEAR_COUNT; i++) {
          const ring = i < 24 ? 0 : 1;
          const idxInRing = ring === 0 ? i : i - 24;
          const totalInRing = ring === 0 ? 24 : 40;
          const baseRadius = (ring === 0 ? 3.8 : 6.4) * (0.75 + 0.35 * curEpoch.a);
          const theta = (idxInRing / totalInRing) * Math.PI * 2 + elapsed * 0.12 * (ring === 0 ? 1 : -0.6);

          const sx = Math.cos(theta) * baseRadius;
          const sz = Math.sin(theta) * baseRadius;
          const sy = -0.75 + 0.15 * Math.sin(theta * 3 + elapsed);

          _vec3A.set(sx, sy, sz);
          _euler.set(0, -theta + Math.PI / 2 + 0.25 * signPolarity * torsionStrength, 0);
          _quat.setFromEuler(_euler);
          _scale.set(shearAmp, 1, 1);
          _mat4.compose(_vec3A, _quat, _scale);
          shearInstanced.setMatrixAt(i, _mat4);
        }
        shearInstanced.instanceMatrix.needsUpdate = true;
      }

      controls.update();
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      updateSceneState(elapsed, delta);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      sheetGeo.dispose();
      sheetMat.dispose();
      wireMat.dispose();
      outerRingGeo.dispose();
      outerRingMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      clusterGeo.dispose();
      clusterMat.dispose();
      filamentGeo.dispose();
      filamentMat.dispose();
      shearGeo.dispose();
      shearMat.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleResetCamera = () => {
    liveStateRef.current.cameraResetRequested = true;
  };

  return (
    <section id="torsion-manifold" className="science-panel rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-slate-100">
              Spacetime Torsion Manifold &amp; Cosmic Web Visualization
            </h2>
            <span className="text-xs font-mono text-cyan-400">
              {viewMode === '3d' ? 'Three.js 3D Live Manifold' : '2D Top-Down Shear Projection'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Visualizes teleparallel torsion curvature T(z), comoving galaxy cluster expansion a(z), and weak lensing shear vectors.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg bg-[#07090E] p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setViewMode('3d');
                liveStateRef.current.cameraResetRequested = true;
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === '3d' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3D Live
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('split');
                liveStateRef.current.cameraResetRequested = true;
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'split' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2D Projection
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLensingOn((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              lensingOn
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                : 'bg-[#07090E] text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            Lensing: {lensingOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Viewport Container: WebGL canvas mounted inside isolated ref div with NO backdrop-filter HUDs */}
      <div className="relative w-full h-[380px] rounded-lg overflow-hidden bg-[#07090E] border border-slate-800">
        <div ref={mountRef} className="w-full h-full" />

        {/* Top-left subtle coordinate readout (solid dark rgba, zero backdrop-blur) */}
        <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-[#0D121D]/95 border border-slate-800 px-3 py-1.5 text-[11px] font-mono tabular-nums text-slate-300">
          <span>a = {epoch.a.toFixed(3)}</span>
          <span className="mx-2 text-slate-600">·</span>
          <span>T(z) = {epoch.T.toFixed(0)}</span>
          <span className="mx-2 text-slate-600">·</span>
          <span>
            w_DE = {epoch.isPole || epoch.wDE === null ? 'Pole' : epoch.wDE.toFixed(2)}
          </span>
          <span className="mx-2 text-slate-600">·</span>
          <span className={epoch.OmegaDE < 0 ? 'text-rose-400' : 'text-cyan-400'}>
            f(T)/6H² = {epoch.fTRatio.toFixed(3)}
          </span>
          {params.branch !== 'lcdm' && (
            <>
              <span className="mx-2 text-slate-600">·</span>
              <span className="text-amber-400">z_trans = {params.zTrans.toFixed(2)}</span>
            </>
          )}
        </div>

        {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockOpen((prev) => !prev)}
            className="px-3 py-1 rounded-t-md bg-[#0D121D]/95 border border-b-0 border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            {dockOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            <span>{dockOpen ? 'Hide Viewport Controls' : 'Show Viewport Controls'}</span>
          </button>

          {dockOpen && (
            <div className="rounded-lg bg-[#0D121D]/95 border border-slate-700 px-4 py-2 flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-300">
              <span>Drag to orbit · Scroll to zoom</span>
              <span className="text-slate-600">|</span>
              <span>Clusters: 136 Comoving Nodes</span>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={handleResetCamera}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Camera</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
