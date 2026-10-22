import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CubeScrollState,
  computeCubeScrollState,
  dampValue,
} from '../utils/scrollPhysics';

export interface DkmCubeCanvasProps {
  onFrameStateChange?: (state: CubeScrollState) => void;
}

/**
 * Low-poly beveled cubie geometry (~180 triangles per cubie instead of ~1,200)
 * centered at (0, 0, 0) so all 26 cubies render in a single InstancedMesh draw call.
 */
function createBeveledCubieGeometry(): THREE.ExtrudeGeometry {
  const s = 0.205;
  const r = 0.024;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    curveSegments: 2,
    depth: s * 2 - 0.07,
    bevelEnabled: true,
    bevelThickness: 0.036,
    bevelSize: 0.036,
    bevelOffset: 0,
    bevelSegments: 2,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Branchless, single-instruction cosine rainbow GLSL ShaderMaterial compatible with
 * THREE.InstancedMesh. Eliminates pow() SFU bottlenecks and multi-branch if/else ladders
 * for locked 60 FPS on mobile (Samsung S23) and desktop.
 */
function createPrismaticGlassMaterial(side: THREE.Side): THREE.ShaderMaterial {
  const isBack = side === THREE.BackSide;
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacityScale: { value: isBack ? 0.46 : 1.0 },
    },
    vertexShader: `
      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying float vCubieEdge;

      void main() {
        vLocalPos = position;

        // Precompute local bevel edge proximity + local bevel normal tilt per vertex
        vec3 ap = abs(position) * 4.1152;
        float maxC = max(ap.x, max(ap.y, ap.z));
        float minC = min(ap.x, min(ap.y, ap.z));
        float midC = ap.x + ap.y + ap.z - maxC - minC;
        float edgePos = smoothstep(0.68, 0.96, midC) * smoothstep(0.74, 0.99, maxC);
        float localBevelTilt = 1.0 - max(abs(normal.x), max(abs(normal.y), abs(normal.z)));
        vCubieEdge = clamp(edgePos + localBevelTilt * 1.4, 0.0, 1.0);

        #ifdef USE_INSTANCING
          mat4 instModel = modelMatrix * instanceMatrix;
        #else
          mat4 instModel = modelMatrix;
        #endif

        vec4 worldPosition = instModel * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(instModel) * normal);
        vViewDir = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacityScale;

      varying vec3 vLocalPos;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying float vCubieEdge;

      // Branchless single-instruction cosine prism spectrum
      vec3 spectralPrism(float t) {
        return 0.54 + 0.46 * cos(6.283185 * (t + vec3(0.0, 0.33, 0.67)));
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vViewDir);

        // Fast polynomial Fresnel (avoids expensive pow())
        float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float invNdotV = 1.0 - ndotv;
        float fresnel = invNdotV * invNdotV * invNdotV;

        float bevelHighlight = vCubieEdge;

        // Fast polynomial specular highlights (2 studio lights, zero pow() calls)
        vec3 L1 = vec3(0.506, 0.623, 0.596);
        vec3 L2 = vec3(-0.735, 0.343, 0.588);

        vec3 H1 = normalize(L1 + V);
        vec3 H2 = normalize(L2 + V);

        float s1 = max(dot(N, H1), 0.0);
        float s1_2 = s1 * s1;
        float s1_4 = s1_2 * s1_2;
        float s1_8 = s1_4 * s1_4;
        float spec1 = s1_8 * s1_8 * s1_8;

        float s2 = max(dot(N, H2), 0.0);
        float s2_2 = s2 * s2;
        float s2_4 = s2_2 * s2_2;
        float spec2 = s2_4 * s2_4 * s2_4;

        // Chromatic dispersion phase
        vec3 R = reflect(-V, N);
        float dispersionPhase =
          dot(R, vec3(0.58, 0.62, 0.52)) * 0.85 +
          (vLocalPos.x - vLocalPos.y + vLocalPos.z) * 2.4 +
          ndotv * 0.9;

        vec3 rainbow = spectralPrism(dispersionPhase);

        float prismStrength = clamp(bevelHighlight * 0.88 + fresnel * 0.72, 0.0, 1.0);
        vec3 glassBase = vec3(0.02, 0.06, 0.13);
        vec3 col = mix(glassBase, rainbow * 1.25, prismStrength);

        float fresnel4 = fresnel * fresnel;
        float whiteGlint = spec1 * 1.35 + spec2 * 0.75 + fresnel4 * 0.62;
        col += vec3(0.92, 0.97, 1.0) * whiteGlint;

        // Transparent face centers ("sem nada no meio") + luminous prismatic bevels
        float alpha = clamp(
          0.05 + bevelHighlight * 0.68 + fresnel * 0.54 + whiteGlint * 0.52,
          0.05,
          0.95
        ) * uOpacityScale;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

/**
 * 100% GPU-Driven 3D Firefly ("Vagalumes") particle system.
 * Zero CPU loop and zero buffer upload per frame.
 */
function createFirefliesSystem() {
  const count = 48;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);

  const palette = [
    new THREE.Color(0x0066ff), // Electric Blue
    new THREE.Color(0x00f0ff), // Luminous Cyan
    new THREE.Color(0xf8fafc), // Soft White
    new THREE.Color(0x38bdf8), // Sky Blue
  ];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 13.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9.5;
    positions[i * 3 + 2] = -6.0 + Math.random() * 7.8;

    const c = palette[i % palette.length];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    scales[i] = 11.0 + Math.random() * 18.0;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: 1 },
    },
    vertexShader: `
      attribute float aScale;
      attribute float aPhase;
      attribute vec3 color;

      uniform float uTime;
      uniform float uScroll;
      uniform vec2 uPointer;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vPulse;

      void main() {
        vColor = color;
        vPulse = 0.45 + 0.55 * sin(uTime * 1.7 + aPhase);

        // Compute organic 3D firefly drift directly on the GPU
        vec3 pos = position;
        pos.x += sin(uTime * 0.42 + aPhase) * 0.36 - uPointer.x * 0.22;
        pos.y += cos(uTime * 0.36 + aPhase * 1.3) * 0.40 + uScroll * 1.25;
        pos.z += sin(uTime * 0.28 + aPhase * 0.7) * 0.22;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(
          aScale * uPixelRatio * (1.0 / -mvPosition.z) * (0.75 + 0.32 * vPulse),
          2.0,
          24.0
        );
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vPulse;

      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float distSq = dot(d, d);
        if (distSq > 0.25) discard;
        // Fast polynomial glow (zero exp/sqrt)
        float falloff = 1.0 - distSq * 4.0;
        float core = falloff * falloff * falloff;
        float alpha = (core * 0.75 + falloff * 0.35) * vPulse;
        vec3 finalColor = mix(vColor, vec3(1.0), core * 0.6);
        gl_FragColor = vec4(finalColor, alpha * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  return { points, geometry, material };
}

export const DkmCubeCanvas: React.FC<DkmCubeCanvasProps> = ({
  onFrameStateChange,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const onFrameRef = useRef(onFrameStateChange);

  useEffect(() => {
    onFrameRef.current = onFrameStateChange;
  }, [onFrameStateChange]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Detect Software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    let isMobileViewport = width < 768;

    // Cap DPR to 1.25 on mobile (e.g., Samsung S23 has DPR=3.0 which is 9x pixels!) and 1.5 on desktop
    const getOptimalPixelRatio = (mobile: boolean) => {
      if (isSoftwareGl) return 1;
      return Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
    };

    const pixelRatio = getOptimalPixelRatio(isMobileViewport);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && !isMobileViewport,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 35);
    camera.position.set(0, 0.12, isMobileViewport ? 6.5 : 5.6);
    camera.lookAt(0, 0, 0);

    // 2. Build 100% GPU Firefly Particles ("Vagalumes")
    const fireflies = createFirefliesSystem();
    fireflies.material.uniforms.uPixelRatio.value = pixelRatio;
    scene.add(fireflies.points);

    // 3. Build Instanced 3x3x3 Hollow Prismatic Glass Rubik's Cube (Only 2 Draw Calls Total!)
    const rubikRootGroup = new THREE.Group();
    scene.add(rubikRootGroup);

    const cubieGeo = createBeveledCubieGeometry();
    const glassBackMat = createPrismaticGlassMaterial(THREE.BackSide);
    const glassFrontMat = createPrismaticGlassMaterial(THREE.FrontSide);

    const CUBIE_COUNT = 26;
    const backInstanced = new THREE.InstancedMesh(
      cubieGeo,
      glassBackMat,
      CUBIE_COUNT
    );
    backInstanced.renderOrder = 1;
    // On mobile viewports, skip back-face overdraw pass to double fill-rate performance
    backInstanced.visible = !isMobileViewport;

    const frontInstanced = new THREE.InstancedMesh(
      cubieGeo,
      glassFrontMat,
      CUBIE_COUNT
    );
    frontInstanced.renderOrder = 2;

    rubikRootGroup.add(backInstanced, frontInstanced);

    interface CubieMeta {
      index: number;
      ix: -1 | 0 | 1;
      iy: -1 | 0 | 1;
      iz: -1 | 0 | 1;
      homePos: THREE.Vector3;
    }

    const cubies: CubieMeta[] = [];
    const SPACING = 0.505;
    const coords: (-1 | 0 | 1)[] = [-1, 0, 1];
    let idx = 0;
    const _initMat = new THREE.Matrix4();

    for (const ix of coords) {
      for (const iy of coords) {
        for (const iz of coords) {
          // Leave the center (0, 0, 0) hollow ("sem nada no meio")
          if (ix === 0 && iy === 0 && iz === 0) continue;

          const homePos = new THREE.Vector3(
            ix * SPACING,
            iy * SPACING,
            iz * SPACING
          );
          _initMat.makeTranslation(homePos.x, homePos.y, homePos.z);
          backInstanced.setMatrixAt(idx, _initMat);
          frontInstanced.setMatrixAt(idx, _initMat);

          cubies.push({
            index: idx,
            ix,
            iy,
            iz,
            homePos,
          });
          idx++;
        }
      }
    }
    backInstanced.instanceMatrix.needsUpdate = true;
    frontInstanced.instanceMatrix.needsUpdate = true;

    // 4. Subtle Optical Reflection Ring beneath the Cube when it stabilizes at the end
    const ringGeo = new THREE.RingGeometry(0.82, 0.85, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.visible = false;
    scene.add(ringMesh);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 5. Scroll & Pointer Tracking (Zero React State Updates)
    let rawScrollProgress = 0;
    const updateScrollFromWindow = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      rawScrollProgress = Math.max(0, Math.min(1, scrollTop / maxScroll));
    };
    updateScrollFromWindow();

    const pointerTarget = { x: 0, y: 0 };
    const pointerSmooth = { x: 0, y: 0 };
    const dragOffset = { x: 0, y: 0 };
    let isDragging = false;
    let lastPointer = { x: 0, y: 0 };

    const handlePointerMove = (e: PointerEvent) => {
      pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerTarget.y = (e.clientY / window.innerHeight) * 2 - 1;

      if (isDragging) {
        const dx = e.clientX - lastPointer.x;
        const dy = e.clientY - lastPointer.y;
        dragOffset.y += dx * 0.007;
        dragOffset.x += dy * 0.007;
        dragOffset.x = Math.max(-0.8, Math.min(0.8, dragOffset.x));
        lastPointer = { x: e.clientX, y: e.clientY };
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('input, textarea, select, button, a, form')) {
        return;
      }
      isDragging = true;
      lastPointer = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      isMobileViewport = w < 768;
      backInstanced.visible = !isMobileViewport;
      const nextDpr = getOptimalPixelRatio(isMobileViewport);
      renderer.setPixelRatio(nextDpr);
      fireflies.material.uniforms.uPixelRatio.value = nextDpr;
      camera.aspect = w / h;
      camera.position.z = isMobileViewport ? 6.5 : 5.6;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      updateScrollFromWindow();
    };

    window.addEventListener('scroll', updateScrollFromWindow, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Pre-allocated scratch math objects (zero GC inside animation loop)
    const _axisVec = new THREE.Vector3();
    const _sliceQuat = new THREE.Quaternion();
    const _identQuat = new THREE.Quaternion();
    const _posVec = new THREE.Vector3();
    const _scaleVec = new THREE.Vector3(1, 1, 1);
    const _instMat = new THREE.Matrix4();

    let frameId = 0;
    let isDisposed = false;
    let lastTimeMs = performance.now();
    const startTimeMs = lastTimeMs;

    let currentRotX = 0.55;
    let currentRotY = -Math.PI / 4;
    let currentRotZ = 0;
    let currentCubeX = 0;
    let currentCubeY = 0.04;
    let currentScale = isMobileViewport ? 0.76 : 0.92;
    let currentSliceAngle = 0;
    let lastSliceAxis: 'x' | 'y' | 'z' = 'y';
    let lastSliceLayer: -1 | 0 | 1 = 1;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
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

    function tick() {
      if (isDisposed) return;
      const nowMs = performance.now();
      const dt = Math.min(Math.max((nowMs - lastTimeMs) / 1000, 0.001), 0.1);
      lastTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;

      const scrollState = computeCubeScrollState(rawScrollProgress, elapsed);

      // Notify DOM overlay controller directly without React re-render
      onFrameRef.current?.(scrollState);

      // Smooth pointer damping
      pointerSmooth.x = dampValue(pointerSmooth.x, pointerTarget.x, 6.5, dt);
      pointerSmooth.y = dampValue(pointerSmooth.y, pointerTarget.y, 6.5, dt);

      // Update GPU firefly uniforms (zero CPU particle loop)
      fireflies.material.uniforms.uTime.value = elapsed;
      fireflies.material.uniforms.uScroll.value = rawScrollProgress;
      fireflies.material.uniforms.uPointer.value.set(
        pointerSmooth.x,
        pointerSmooth.y
      );

      if (scrollState.landingFactor > 0.7 && !isDragging) {
        dragOffset.x = dampValue(dragOffset.x, 0, 4.5, dt);
        dragOffset.y = dampValue(dragOffset.y, 0, 4.5, dt);
      }

      const mouseInfluence = 1 - scrollState.landingFactor * 0.75;
      const desiredRotX =
        scrollState.targetRotX +
        pointerSmooth.y * 0.32 * mouseInfluence +
        dragOffset.x;
      const desiredRotY =
        scrollState.targetRotY +
        pointerSmooth.x * 0.44 * mouseInfluence +
        dragOffset.y;
      const desiredRotZ =
        scrollState.targetRotZ - pointerSmooth.x * 0.12 * mouseInfluence;

      // On desktop, shift cube horizontally away from active text column; on mobile keep X=0 and raise Y slightly during acts 1..3
      const desktopTargetX = isMobileViewport ? 0 : scrollState.cubeX;
      const mobileStoryLift =
        isMobileViewport &&
        scrollState.scrollProgress > 0.05 &&
        scrollState.landingFactor < 0.5
          ? 0.62 * (1 - scrollState.landingFactor)
          : 0;
      const desiredCubeY = scrollState.cubeY + mobileStoryLift;

      currentRotX = dampValue(currentRotX, desiredRotX, 9.0, dt);
      currentRotY = dampValue(currentRotY, desiredRotY, 9.0, dt);
      currentRotZ = dampValue(currentRotZ, desiredRotZ, 9.0, dt);
      currentCubeX = dampValue(currentCubeX, desktopTargetX, 8.0, dt);
      currentCubeY = dampValue(currentCubeY, desiredCubeY, 9.0, dt);

      const baseScale = isMobileViewport ? 0.72 : 0.92;
      const landedScale = isMobileViewport ? 0.38 : 0.44;
      const desiredScale =
        baseScale * (1 - scrollState.landingFactor) +
        landedScale * scrollState.landingFactor;
      currentScale = dampValue(currentScale, desiredScale, 8.5, dt);

      rubikRootGroup.rotation.set(currentRotX, currentRotY, currentRotZ);
      rubikRootGroup.position.set(currentCubeX, currentCubeY, 0);
      rubikRootGroup.scale.setScalar(currentScale);

      // Apply 1:1 Rubik's Cube slice rotation via InstancedMesh matrices
      const move = scrollState.activeSliceMove;
      if (move.axis !== lastSliceAxis || move.layer !== lastSliceLayer) {
        currentSliceAngle = move.angleRad;
        lastSliceAxis = move.axis;
        lastSliceLayer = move.layer;
      } else {
        currentSliceAngle = dampValue(currentSliceAngle, move.angleRad, 14.0, dt);
      }

      if (move.axis === 'x') _axisVec.set(1, 0, 0);
      else if (move.axis === 'y') _axisVec.set(0, 1, 0);
      else _axisVec.set(0, 0, 1);

      _sliceQuat.setFromAxisAngle(_axisVec, currentSliceAngle);

      for (let i = 0; i < CUBIE_COUNT; i++) {
        const c = cubies[i];
        const coordVal =
          move.axis === 'x' ? c.ix : move.axis === 'y' ? c.iy : c.iz;

        if (coordVal === move.layer && Math.abs(currentSliceAngle) > 0.0005) {
          _posVec.copy(c.homePos).applyQuaternion(_sliceQuat);
          _instMat.compose(_posVec, _sliceQuat, _scaleVec);
        } else {
          _instMat.compose(c.homePos, _identQuat, _scaleVec);
        }
        frontInstanced.setMatrixAt(i, _instMat);
        if (backInstanced.visible) {
          backInstanced.setMatrixAt(i, _instMat);
        }
      }
      frontInstanced.instanceMatrix.needsUpdate = true;
      if (backInstanced.visible) {
        backInstanced.instanceMatrix.needsUpdate = true;
      }

      // Subtle optical landing ring
      ringMesh.visible = scrollState.pedestalOpacity > 0.01;
      if (ringMesh.visible) {
        ringMesh.position.set(currentCubeX, scrollState.pedestalY - 0.42, 0);
        ringMat.opacity = scrollState.pedestalOpacity * 0.36;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('scroll', updateScrollFromWindow);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);

      cubieGeo.dispose();
      glassBackMat.dispose();
      glassFrontMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      fireflies.geometry.dispose();
      fireflies.material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      data-testid="dkm-3d-canvas"
      className="fixed inset-0 w-full h-full pointer-events-auto z-0"
      aria-label="Cubo Mágico 3D de vidro prismático interativo da DKM"
    />
  );
};
