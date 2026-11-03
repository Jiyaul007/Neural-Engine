import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseVelocity;
uniform float uScrollProgress;
uniform vec2 uShockwaveCenter;
uniform float uShockwaveTime;

varying vec2 vUv;

// Simplex 3D Noise by Ian McEwan, Ashima Arts
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

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
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
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

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

void main() {
  vec2 uv = vUv;
  
  // Calculate flow field
  float t = uTime * 0.06 + uScrollProgress * 0.5;
  vec3 p = vec3(uv * 2.5, t);
  
  // Mouse fluid disturbance
  vec2 normMouse = uMouse * 0.5 + 0.5;
  float distToMouse = distance(uv, normMouse);
  float mouseInfluence = smoothstep(0.45, 0.0, distToMouse) * min(uMouseVelocity * 2.5, 1.5);
  p.xy += normalize(uv - normMouse + 0.001) * mouseInfluence * 0.4;
  
  // Shockwave fluid refraction
  if (uShockwaveTime >= 0.0 && uShockwaveTime < 2.0) {
    vec2 normShock = uShockwaveCenter * 0.5 + 0.5;
    float distShock = distance(uv, normShock);
    float wavePos = uShockwaveTime * 0.8;
    float shockDiff = abs(distShock - wavePos);
    float shockRing = exp(-shockDiff * shockDiff * 45.0) * exp(-uShockwaveTime * 2.0);
    p.xy += normalize(uv - normShock + 0.001) * shockRing * 0.3;
  }
  
  vec3 flow = curlNoise(p);
  
  // Multi-frequency filament veins
  float n1 = abs(snoise(p * 1.5 + flow * 0.4));
  float n2 = abs(snoise(p * 3.0 - flow * 0.3));
  float filaments = pow(n1 * 0.7 + n2 * 0.3, 3.5);
  
  // Deep obsidian Void with ethereal cyan and indigo luminous veins
  vec3 voidColor = vec3(0.002, 0.004, 0.012);
  vec3 cyanVein = vec3(0.0, 0.65, 0.85);
  vec3 indigoVein = vec3(0.2, 0.08, 0.55);
  
  vec3 finalColor = voidColor + mix(indigoVein, cyanVein, flow.z * 0.5 + 0.5) * filaments * 0.8;
  
  // Convergence nodes glow
  float convergence = max(0.0, 1.0 - length(flow.xy));
  float nodeGlow = pow(convergence, 6.0) * 0.4;
  finalColor += vec3(0.0, 0.8, 1.0) * nodeGlow;
  
  gl_FragColor = vec4(finalColor, 0.85);
}
`;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Screen-space NDC fullscreen quad
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

export function FluidDistortion() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseVelocity: { value: 0 },
    uScrollProgress: { value: 0 },
    uShockwaveCenter: { value: new THREE.Vector2(0, 0) },
    uShockwaveTime: { value: 99.0 },
  }), []);

  useFrame(() => {
    if (!materialRef.current) return;
    const state = useSystemState.getState();
    
    materialRef.current.uniforms.uTime.value = state.time;
    materialRef.current.uniforms.uMouse.value.set(state.pointer.nx, state.pointer.ny);
    materialRef.current.uniforms.uMouseVelocity.value = state.pointer.speed;
    materialRef.current.uniforms.uScrollProgress.value = state.scroll.progress;
    
    const shockElapsed = (performance.now() / 1000) - state.shockwave.time;
    materialRef.current.uniforms.uShockwaveCenter.value.set(state.shockwave.x, state.shockwave.y);
    materialRef.current.uniforms.uShockwaveTime.value = shockElapsed;
  });

  return (
    <mesh renderOrder={-999}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
        transparent={true}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}
