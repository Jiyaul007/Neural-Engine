import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSystemState, ManifoldMode } from '../engine/SystemState';
import { PARTICLE_COUNT_WEBGL } from '../engine/constants';

// ── Full 3D Simplex Noise + Curl Noise in GLSL ──
const NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  float p_x0 = snoise(p - dx);
  float p_x1 = snoise(p + dx);
  float p_y0 = snoise(p - dy);
  float p_y1 = snoise(p + dy);
  float p_z0 = snoise(p - dz);
  float p_z1 = snoise(p + dz);
  float x = (p_y1 - p_y0) - (p_z1 - p_z0);
  float y = (p_z1 - p_z0) - (p_x1 - p_x0);
  float z = (p_x1 - p_x0) - (p_y1 - p_y0);
  return normalize(vec3(x, y, z) / (2.0 * e));
}
`;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform vec3 uMouse;
uniform float uScrollProgress;
uniform float uFormation;
uniform float uScrollVelocity;
uniform int uPrevManifoldMode;
uniform int uManifoldMode;
uniform float uMorphProgress;
uniform float uTurbulenceBoost;
uniform vec3 uShockwaveCenter;
uniform float uShockwaveTime;
uniform float uShockwaveStrength;

attribute float aRandom;
attribute float aIndex;

varying float vVelocity;
varying float vDepth;
varying float vRandom;
varying vec3 vWorldPos;
varying float vShockHighlight;
varying float vMorphGlow;

${NOISE_GLSL}

// Procedural Manifold Formations calculated dynamically on GPU
vec3 getManifoldPosition(int mode, float idx, float rnd, vec3 basePos, float t) {
  // 0: NEURAL CORE (Fibonacci spiral sphere)
  if (mode == 0) {
    float phi = acos(clamp(1.0 - 2.0 * rnd, -1.0, 1.0));
    float theta = idx * 2.39996323; // Golden angle
    float r = 2.8 + sin(idx * 50.0 + t * 2.0) * 0.25;
    return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta)) * r;
  }
  // 1: QUANTUM TORUS (Clifford torus manifold)
  else if (mode == 1) {
    float u = rnd * 6.283185;
    float v = idx * 6.283185 + t * 0.5;
    float R = 3.2;
    float r = 1.1;
    return vec3((R + r * cos(v)) * cos(u), r * sin(v), (R + r * cos(v)) * sin(u));
  }
  // 2: DOUBLE HELIX (Intertwined AI genetic code)
  else if (mode == 2) {
    float strand = step(0.5, fract(idx * 133.0));
    float y = (rnd - 0.5) * 8.0;
    float angle = y * 2.0 + strand * 3.14159 + t * 0.6;
    float radius = 2.2 + sin(y * 4.0 + t) * 0.3;
    return vec3(cos(angle) * radius, y, sin(angle) * radius);
  }
  // 3: SYNAPTIC TENSOR LATTICE (Hyperdimensional tensor array)
  else if (mode == 3) {
    vec3 q = sin(vec3(idx * 17.0, rnd * 23.0, fract(idx * 71.0) * 31.0) * 6.28);
    return round(q * 2.0) * 1.35;
  }
  // 4: GRAVITATIONAL SINGULARITY (Accretion disk & event horizon)
  else {
    float r = 0.6 + pow(rnd, 2.5) * 4.8;
    float theta = idx * 6.283185 + t * (2.2 / (r + 0.2));
    float zWarp = sin(r * 5.0 - t * 3.0) * 0.2;
    return vec3(cos(theta) * r, (fract(idx * 97.0) - 0.5) * 0.15 * r + zWarp, sin(theta) * r);
  }
}

void main() {
  vec3 pos = position;
  
  // Dynamic Curl Noise vector field
  float noiseScale = 0.28 + aRandom * 0.15;
  float timeScale = uTime * (0.15 + uTurbulenceBoost * 0.4);
  vec3 noisePos = pos * noiseScale + timeScale;
  vec3 curl = curlNoise(noisePos) * (1.6 + uTurbulenceBoost * 2.5);
  
  vec3 organicCloud = pos + curl;
  
  // Mouse Gravity Attraction with fluid vortex swirl
  vec3 toMouse = uMouse - organicCloud;
  float distToMouse = length(toMouse);
  float attractForce = 1.0 / (distToMouse * distToMouse + 0.4);
  attractForce = min(attractForce, 2.8);
  
  // Tangential vortex rotation around cursor
  vec3 vortex = cross(normalize(toMouse + 0.001), vec3(0.0, 0.0, 1.0)) * attractForce * 0.4;
  organicCloud += (normalize(toMouse + 0.001) + vortex) * attractForce * 0.8;
  
  // 4D Geodesic Manifold Morphing (smooth cubic Hermite interpolation)
  vec3 targetPrev = getManifoldPosition(uPrevManifoldMode, aIndex, aRandom, pos, uTime);
  vec3 targetNext = getManifoldPosition(uManifoldMode, aIndex, aRandom, pos, uTime);
  float morphEase = smoothstep(0.0, 1.0, uMorphProgress);
  vec3 manifoldTarget = mix(targetPrev, targetNext, morphEase);
  
  // Morph between organic cloud and target manifold
  vec3 finalPos = mix(organicCloud, manifoldTarget, uFormation);
  
  // Kinetic shockwave physics
  float shockHighlight = 0.0;
  if (uShockwaveTime >= 0.0 && uShockwaveTime < 2.5) {
    vec3 toShock = finalPos - uShockwaveCenter;
    float shockDist = length(toShock);
    float waveFront = uShockwaveTime * 7.5; // Radial wavefront expansion speed
    float distDiff = abs(shockDist - waveFront);
    
    float waveThickness = 1.4;
    float waveMask = exp(-distDiff * distDiff / (waveThickness * waveThickness));
    float decay = exp(-uShockwaveTime * 1.6);
    float impulse = waveMask * decay * uShockwaveStrength * 2.8;
    
    finalPos += normalize(toShock + 0.001) * impulse * sin(uShockwaveTime * 14.0 - shockDist * 1.8);
    shockHighlight = waveMask * decay;
  }
  vShockHighlight = shockHighlight;
  
  // Cymatic harmonic standing-wave vibration
  float cymatics = sin(length(finalPos) * 3.2 - uTime * 2.0) * sin(finalPos.y * 2.2 + uTime * 1.6);
  finalPos += normalize(finalPos + 0.001) * cymatics * (0.05 + uTurbulenceBoost * 0.09);
  
  // Subtle velocity kinetic reaction (energy wave)
  float kineticEnergy = min(abs(uScrollVelocity) * 0.4, 0.8);
  finalPos += curl * kineticEnergy * 0.3;
  
  // Morphing kinetic trail illumination
  float morphingActive = sin(morphEase * 3.14159);
  vMorphGlow = morphingActive;
  
  vVelocity = length(curl) * 0.3 + attractForce * 0.5 + uTurbulenceBoost * 0.8 + kineticEnergy * 0.5 + shockHighlight * 1.5;
  vRandom = aRandom;
  
  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  vDepth = -mvPosition.z;
  vWorldPos = finalPos;
  
  // Point Size attenuation: crisp, professional, perfectly scaled
  float baseSize = 2.0 + aRandom * 1.8;
  float velBoost = vVelocity * 1.5 + morphingActive * 1.0;
  gl_PointSize = clamp((baseSize + velBoost) * (180.0 / max(-mvPosition.z * 18.0, 1.0)), 1.5, 8.5);
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform int uManifoldMode;
uniform int uPrevManifoldMode;
uniform float uMorphProgress;
uniform float uTime;

varying float vVelocity;
varying float vDepth;
varying float vRandom;
varying vec3 vWorldPos;
varying float vShockHighlight;
varying float vMorphGlow;

vec3 getModeColor(int mode) {
  if (mode == 1) return vec3(0.88, 0.25, 1.0);    // Quantum Torus: Prismatic Purple
  if (mode == 2) return vec3(0.0, 1.0, 0.65);     // Double Helix: Emerald Green
  if (mode == 3) return vec3(1.0, 0.65, 0.15);    // Tensor Lattice: Solar Amber
  if (mode == 4) return vec3(1.0, 0.18, 0.5);     // Singularity: Relativistic Magenta
  return vec3(0.0, 0.94, 1.0);                    // Neural Core: Electric Cyan
}

vec3 getModeOuter(int mode) {
  if (mode == 1) return vec3(0.35, 0.05, 0.75);
  if (mode == 2) return vec3(0.02, 0.38, 0.22);
  if (mode == 3) return vec3(0.55, 0.18, 0.02);
  if (mode == 4) return vec3(0.45, 0.02, 0.25);
  return vec3(0.05, 0.22, 0.85);
}

void main() {
  // Soft, perfectly antialiased multi-layer stellar disc
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;
  
  // Multi-spectral optical diffraction masks
  float coreMask = smoothstep(0.12, 0.0, dist);  // Sub-pixel white-hot diamond kernel
  float midMask  = smoothstep(0.38, 0.06, dist); // Chromatic diffraction ring
  float haloMask = smoothstep(0.5, 0.18, dist);  // Soft celestial aura
  
  // Continuous smooth manifold color interpolation
  float morphEase = smoothstep(0.0, 1.0, uMorphProgress);
  vec3 midColor = mix(getModeColor(uPrevManifoldMode), getModeColor(uManifoldMode), morphEase);
  vec3 outerColor = mix(getModeOuter(uPrevManifoldMode), getModeOuter(uManifoldMode), morphEase);
  vec3 coreColor = vec3(1.0, 1.0, 1.0);
  
  // Twinkle sparkle glint based on 3D rotation and time
  float twinkle = sin(uTime * 4.0 + vRandom * 62.83) * 0.5 + 0.5;
  twinkle = pow(twinkle, 3.0);
  
  vec3 color = mix(outerColor, midColor, midMask);
  color = mix(color, coreColor, coreMask);
  
  // Kinetic energy and shockwave illumination
  color += vVelocity * 0.28 * vec3(0.3, 0.7, 1.0);
  color += vShockHighlight * 1.8 * vec3(0.7, 0.9, 1.0);
  color += vMorphGlow * 0.4 * vec3(0.4, 0.8, 1.0);
  color += twinkle * 0.25 * vec3(0.8, 0.9, 1.0);
  
  // Atmospheric depth fade
  float depthFade = smoothstep(28.0, 3.0, vDepth);
  float alpha = (coreMask * 0.95 + midMask * 0.65 + haloMask * 0.28) * depthFade * (0.7 + vRandom * 0.3);
  alpha += vShockHighlight * 0.35;
  
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`;

const MANIFOLD_MAP: Record<ManifoldMode, number> = {
  core: 0,
  torus: 1,
  helix: 2,
  lattice: 3,
  singularity: 4,
};

export const NeuralCore: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const particleCount = PARTICLE_COUNT_WEBGL;

  const { positions, randoms, indices } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const rnd = new Float32Array(particleCount);
    const idx = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const r = 5 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      rnd[i] = Math.random();
      idx[i] = i / particleCount;
    }

    return { positions: pos, randoms: rnd, indices: idx };
  }, [particleCount]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector3() },
      uScrollProgress: { value: 0 },
      uFormation: { value: 0 },
      uScrollVelocity: { value: 0 },
      uPrevManifoldMode: { value: 0 },
      uManifoldMode: { value: 0 },
      uMorphProgress: { value: 1.0 },
      uTurbulenceBoost: { value: 0 },
      uShockwaveCenter: { value: new THREE.Vector3(0, 0, 0) },
      uShockwaveTime: { value: 99.0 },
      uShockwaveStrength: { value: 0.0 },
    }),
    [],
  );

  const formationTarget = useRef(0);
  const turbulenceTarget = useRef(0);
  const currModeRef = useRef(0);
  const prevModeRef = useRef(0);
  const morphProgressRef = useRef(1.0);

  useFrame((_, delta) => {
    const state = useSystemState.getState();
    const mat = materialRef.current;
    if (!mat) return;

    mat.uniforms.uTime.value = state.time;
    mat.uniforms.uScrollProgress.value = state.scroll.progress;
    mat.uniforms.uScrollVelocity.value = state.scroll.velocity;

    // Smooth Geodesic Manifold Morphing
    const targetMode = MANIFOLD_MAP[state.manifoldMode] ?? 0;
    if (targetMode !== currModeRef.current) {
      prevModeRef.current = currModeRef.current;
      currModeRef.current = targetMode;
      morphProgressRef.current = 0.0;
    }

    if (morphProgressRef.current < 1.0) {
      morphProgressRef.current = Math.min(1.0, morphProgressRef.current + delta * 1.6);
    }

    mat.uniforms.uPrevManifoldMode.value = prevModeRef.current;
    mat.uniforms.uManifoldMode.value = currModeRef.current;
    mat.uniforms.uMorphProgress.value = morphProgressRef.current;

    // Mouse coordinates in 3D world space
    mat.uniforms.uMouse.value.set(
      state.pointer.nx * 5.2,
      state.pointer.ny * 5.2,
      0,
    );

    // Shockwave parameters
    const shockElapsed = (performance.now() / 1000) - state.shockwave.time;
    mat.uniforms.uShockwaveCenter.value.set(
      state.shockwave.x * 5.2,
      state.shockwave.y * 5.2,
      0,
    );
    mat.uniforms.uShockwaveTime.value = shockElapsed;
    mat.uniforms.uShockwaveStrength.value = state.shockwave.strength;

    // Active inference acceleration
    if (state.inference === 'generating') {
      turbulenceTarget.current = 1.0;
    } else if (state.inference === 'processing') {
      turbulenceTarget.current = 0.5;
    } else {
      turbulenceTarget.current = 0.0;
    }

    const currTurb = mat.uniforms.uTurbulenceBoost.value;
    mat.uniforms.uTurbulenceBoost.value += (turbulenceTarget.current - currTurb) * 0.08;

    // Formation transition curve
    switch (state.inference) {
      case 'boot':
        formationTarget.current = 0.0;
        break;
      case 'processing':
        formationTarget.current = 0.45;
        break;
      case 'generating':
        formationTarget.current = 0.85;
        break;
      case 'idle':
      case 'resolved':
        formationTarget.current = 0.72;
        break;
    }

    const currentForm = mat.uniforms.uFormation.value;
    mat.uniforms.uFormation.value += (formationTarget.current - currentForm) * 0.03;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={particleCount}
          array={randoms}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aIndex"
          count={particleCount}
          array={indices}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
