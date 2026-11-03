import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSystemState, ManifoldMode } from '../engine/SystemState';

// ---------------------------------------------------------------------------
// Simulation Shaders (Ping-Pong FBO Physics)
// ---------------------------------------------------------------------------

const SIM_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const SIM_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uCurrentPosition;
  uniform sampler2D uCurrentVelocity;
  uniform float uTime;
  uniform float uDelta;
  uniform vec2 uMouse;
  uniform float uTurbulence;
  uniform int uManifoldMode;
  uniform bool uIsInit;

  varying vec2 vUv;

  // 3D Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
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
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  vec3 curlNoise(vec3 p) {
    float eps = 0.08;
    float n1 = snoise(p + vec3(0.0, eps, 0.0)) - snoise(p - vec3(0.0, eps, 0.0));
    float n2 = snoise(p + vec3(0.0, 0.0, eps)) - snoise(p - vec3(0.0, 0.0, eps));
    float n3 = snoise(p + vec3(eps, 0.0, 0.0)) - snoise(p - vec3(eps, 0.0, 0.0));
    return vec3(n1, n2, n3) / (2.0 * eps);
  }

  vec3 getManifoldTarget(vec2 uv, int mode) {
    float i = uv.x * 512.0 + uv.y * 512.0 * 512.0;
    float t = i / (512.0 * 512.0);

    if (mode == 0) {
      // Core: Fibonacci golden spiral sphere
      float phi = 2.399963;
      float y = 1.0 - t * 2.0;
      float r = sqrt(max(0.0, 1.0 - y * y));
      float theta = phi * i;
      return vec3(cos(theta) * r, y, sin(theta) * r) * 3.6;
    } else if (mode == 1) {
      // Torus
      float a1 = t * 6.283185 * 6.0;
      float a2 = t * 6.283185 * 14.0;
      float R = 2.8, r = 1.0;
      return vec3((R + r * cos(a2)) * cos(a1), r * sin(a2), (R + r * cos(a2)) * sin(a1));
    } else if (mode == 2) {
      // Helix dual strand
      float h = (t - 0.5) * 12.0;
      float twist = t * 6.283185 * 5.0;
      float strand = step(0.5, fract(i * 0.5)) * 2.0 - 1.0;
      float radius = 1.4;
      return vec3(cos(twist + strand * 1.5708) * radius, h, sin(twist + strand * 1.5708) * radius);
    } else if (mode == 3) {
      // Lattice grid
      float xi = fract(t * 16.0);
      float yi = fract(t * 16.0 * 1.618);
      float zi = fract(t * 16.0 * 2.414);
      return (vec3(xi, yi, zi) - 0.5) * 8.0;
    } else {
      // Singularity accretion disk
      float angle = t * 6.283185 * 80.0;
      float diskR = pow(t, 0.45) * 4.8 + 0.2;
      float diskY = (fract(t * 53.0) - 0.5) * 0.2 * (1.0 - t);
      return vec3(cos(angle) * diskR, diskY, sin(angle) * diskR);
    }
  }

  void main() {
    if (uIsInit) {
      vec3 initTarget = getManifoldTarget(vUv, 0);
      gl_FragColor = vec4(initTarget, 0.0);
      return;
    }

    vec4 posData = texture2D(uCurrentPosition, vUv);
    vec3 pos = posData.xyz;
    float age = posData.w + uDelta;

    vec3 target = getManifoldTarget(vUv, uManifoldMode);
    vec3 toTarget = target - pos;
    float dist = length(toTarget);

    // Dynamic forces
    vec3 force = toTarget * 0.05;

    // Curl noise turbulence
    vec3 curl = curlNoise(pos * 0.35 + vec3(uTime * 0.12));
    force += curl * (0.015 + uTurbulence * 0.06);

    // Mouse interactive deflection
    vec3 mouse3D = vec3(uMouse * 4.0, 0.0);
    vec3 toMouse = pos - mouse3D;
    float mouseD = length(toMouse);
    if (mouseD < 1.8 && mouseD > 0.001) {
      force += normalize(toMouse) * (1.8 - mouseD) * 0.12;
    }

    pos += force;
    gl_FragColor = vec4(pos, age);
  }
`;

// ---------------------------------------------------------------------------
// Render Shaders (Visual Points)
// ---------------------------------------------------------------------------

const RENDER_VERT_SHADER = /* glsl */ `
  uniform sampler2D uPositionTex;
  uniform float uPointSize;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 posData = texture2D(uPositionTex, position.xy);
    vec3 worldPos = posData.xyz;

    vec4 mvPos = modelViewMatrix * vec4(worldPos, 1.0);
    float dist = -mvPos.z;

    gl_PointSize = clamp(uPointSize / max(dist, 0.5), 1.0, 5.0);
    gl_Position = projectionMatrix * mvPos;

    float speed = length(worldPos) * 0.15;
    vec3 c1 = vec3(0.0, 0.94, 1.0); // Cyan
    vec3 c2 = vec3(1.0, 0.2, 0.6);  // Magenta
    vColor = mix(c1, c2, clamp(speed, 0.0, 1.0));
    vAlpha = clamp(0.3 + 0.7 * (1.0 - smoothstep(1.0, 15.0, dist)), 0.1, 0.85);
  }
`;

const RENDER_FRAG_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 pc = gl_PointCoord - 0.5;
    float d = length(pc);
    if (d > 0.5) discard;

    float glow = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

const SIM_SIZE = 512; // 512x512 = 262,144 particles
const TOTAL_PARTICLES = SIM_SIZE * SIM_SIZE;

export const FBOParticles: React.FC = () => {
  const { gl } = useThree();
  const manifoldMode = useSystemState((s) => s.manifoldMode);
  const inference = useSystemState((s) => s.inference);
  const pointer = useSystemState((s) => s.pointer);

  // Check WebGL2 float render target support
  const isSupported = useMemo(() => {
    return gl.capabilities.isWebGL2;
  }, [gl]);

  // Ping-pong render targets
  const [fboA, fboB] = useMemo(() => {
    const options: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      stencilBuffer: false,
      depthBuffer: false,
    };
    return [
      new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, options),
      new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, options),
    ];
  }, []);

  const targetsRef = useRef({ current: fboA, next: fboB });
  const isInitRef = useRef(true);

  // Simulation scene & fullscreen quad
  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const simMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SIM_VERTEX_SHADER,
      fragmentShader: SIM_FRAGMENT_SHADER,
      uniforms: {
        uCurrentPosition: { value: null },
        uCurrentVelocity: { value: null },
        uTime: { value: 0 },
        uDelta: { value: 0.016 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uTurbulence: { value: 0.0 },
        uManifoldMode: { value: 0 },
        uIsInit: { value: true },
      },
    });
  }, []);

  useEffect(() => {
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMesh = new THREE.Mesh(quadGeo, simMaterial);
    simScene.add(quadMesh);
    return () => {
      quadGeo.dispose();
      simMaterial.dispose();
      fboA.dispose();
      fboB.dispose();
    };
  }, [simScene, simMaterial, fboA, fboB]);

  // Render particle points geometry
  const [renderGeo, renderMat] = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(TOTAL_PARTICLES * 3);

    let idx = 0;
    for (let y = 0; y < SIM_SIZE; y++) {
      for (let x = 0; x < SIM_SIZE; x++) {
        positions[idx * 3 + 0] = (x + 0.5) / SIM_SIZE;
        positions[idx * 3 + 1] = (y + 0.5) / SIM_SIZE;
        positions[idx * 3 + 2] = 0;
        idx++;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: RENDER_VERT_SHADER,
      fragmentShader: RENDER_FRAG_SHADER,
      uniforms: {
        uPositionTex: { value: null },
        uPointSize: { value: 3.5 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return [geo, mat];
  }, []);

  useFrame((state, delta) => {
    if (!isSupported) return;

    const modeInt =
      manifoldMode === 'core' ? 0 :
      manifoldMode === 'torus' ? 1 :
      manifoldMode === 'helix' ? 2 :
      manifoldMode === 'lattice' ? 3 : 4;

    const { current, next } = targetsRef.current;

    // Update simulation uniforms
    simMaterial.uniforms.uCurrentPosition.value = current.texture;
    simMaterial.uniforms.uTime.value = state.clock.getElapsedTime();
    simMaterial.uniforms.uDelta.value = Math.min(delta, 0.05);
    simMaterial.uniforms.uMouse.value.set(pointer.nx, pointer.ny);
    simMaterial.uniforms.uTurbulence.value = inference === 'generating' ? 1.0 : 0.0;
    simMaterial.uniforms.uManifoldMode.value = modeInt;
    simMaterial.uniforms.uIsInit.value = isInitRef.current;

    // Render physics pass into next target
    const currentRT = gl.getRenderTarget();
    gl.setRenderTarget(next);
    gl.render(simScene, simCam);
    gl.setRenderTarget(currentRT);

    // Swap targets
    targetsRef.current = { current: next, next: current };
    isInitRef.current = false;

    // Update visual points material with newest positions
    renderMat.uniforms.uPositionTex.value = next.texture;
    renderMat.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  if (!isSupported) return null;

  return (
    <points geometry={renderGeo} material={renderMat} frustumCulled={false} />
  );
};
