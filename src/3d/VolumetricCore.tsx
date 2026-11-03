import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';

// ---------------------------------------------------------------------------
// Volumetric Raymarching Shaders (Fullscreen Quad SDF)
// ---------------------------------------------------------------------------

const VOLUMETRIC_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const VOLUMETRIC_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform mat4 uInvProjection;
  uniform mat4 uInvView;
  uniform int uInferenceState;
  uniform float uScrollProgress;

  varying vec2 vUv;

  // 3D Simplex noise
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

  // Smooth minimum for blending organic SDF geometries
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Signed distance function of neural organic core
  float sceneSDF(vec3 p) {
    vec3 q = p + 0.35 * vec3(
      snoise(p * 0.6 + vec3(uTime * 0.15)),
      snoise(p * 0.6 + vec3(uTime * 0.15 + 2.1)),
      snoise(p * 0.6 + vec3(uTime * 0.15 + 4.3))
    );

    float d = length(q) - 1.7;

    // Organic neural tendrils
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float angle = fi * 1.2566; // 2 * PI / 5
      vec3 tendrilDir = vec3(cos(angle), sin(fi * 0.7), sin(angle)) * 1.6;
      vec3 tendrilPos = tendrilDir + 0.25 * sin(uTime * 0.6 + fi);
      float td = length(p - tendrilPos) - (0.35 + 0.12 * sin(uTime * 1.2 + fi * 1.5));
      d = smin(d, td, 0.7);
    }

    return d;
  }

  // Finite differences normal computation
  vec3 calcNormal(vec3 p) {
    const float eps = 0.002;
    const vec2 h = vec2(eps, 0);
    return normalize(vec3(
      sceneSDF(p + h.xyy) - sceneSDF(p - h.xyy),
      sceneSDF(p + h.yxy) - sceneSDF(p - h.yxy),
      sceneSDF(p + h.yyx) - sceneSDF(p - h.yyx)
    ));
  }

  void main() {
    // Only show primarily in Hero / Ingestion phase (scroll 0.0 to 0.45)
    float visibility = 1.0 - smoothstep(0.18, 0.45, uScrollProgress);
    if (visibility <= 0.001) {
      discard;
    }

    // Reconstruct camera ray in world space
    vec2 ndc = vUv * 2.0 - 1.0;
    vec4 clip = vec4(ndc, -1.0, 1.0);
    vec4 view = uInvProjection * clip;
    view /= view.w;
    vec3 rayDir = normalize((uInvView * vec4(view.xyz, 0.0)).xyz);
    vec3 rayOrigin = (uInvView * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    // Sphere tracing loop (64 steps)
    float t = 0.5;
    float maxDist = 20.0;
    float hitDist = -1.0;
    float glowAccum = 0.0;

    for (int i = 0; i < 64; i++) {
      vec3 p = rayOrigin + rayDir * t;
      float d = sceneSDF(p);

      // Accumulate volumetric outer glow
      glowAccum += max(0.0, 0.25 - d) * 0.035;

      if (d < 0.005) {
        hitDist = t;
        break;
      }
      t += max(d * 0.7, 0.02);
      if (t > maxDist) break;
    }

    // Palette base
    vec3 coreColor = vec3(0.0, 0.85, 1.0); // Cyan
    if (uInferenceState == 3) {
      coreColor = vec3(1.0, 0.15, 0.7); // Magenta during generating
    } else if (uInferenceState == 4) {
      coreColor = vec3(1.0, 0.75, 0.1); // Gold when resolved
    }

    vec3 finalColor = vec3(0.0);
    float alpha = 0.0;

    if (hitDist > 0.0) {
      vec3 p = rayOrigin + rayDir * hitDist;
      vec3 norm = calcNormal(p);
      vec3 viewDir = -rayDir;

      // Rim / Fresnel lighting
      float rim = 1.0 - max(0.0, dot(viewDir, norm));
      rim = pow(rim, 2.5);

      // Subsurface scattering proxy (density estimate)
      float sss = clamp(1.0 - sceneSDF(p - norm * 0.2) * 2.5, 0.0, 1.0);

      // Neural firing pulses
      float pulse = sin(uTime * 3.5 + p.y * 4.0) * 0.5 + 0.5;

      vec3 innerColor = vec3(0.005, 0.04, 0.08);
      vec3 surfaceEmission = coreColor * (rim * 1.4 + sss * 0.8 + pulse * 0.35);

      finalColor = innerColor + surfaceEmission;
      alpha = 0.85;
    }

    // Add volumetric halo glow
    finalColor += coreColor * glowAccum * 0.9;
    alpha = max(alpha, clamp(glowAccum * 1.4, 0.0, 0.75));

    finalColor *= visibility;
    alpha *= visibility;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export const VolumetricCore: React.FC = () => {
  const { camera, size } = useThree();
  const inference = useSystemState((s) => s.inference);
  const scrollProgress = useSystemState((s) => s.scroll.progress);

  const matRef = useRef<THREE.ShaderMaterial>(null);

  const volumetricMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VOLUMETRIC_VERT,
      fragmentShader: VOLUMETRIC_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uInvProjection: { value: new THREE.Matrix4() },
        uInvView: { value: new THREE.Matrix4() },
        uInferenceState: { value: 1 },
        uScrollProgress: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [size.width, size.height]);

  useFrame((state) => {
    if (!matRef.current) return;

    const infInt =
      inference === 'boot' ? 0 :
      inference === 'idle' ? 1 :
      inference === 'processing' ? 2 :
      inference === 'generating' ? 3 : 4;

    matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    matRef.current.uniforms.uResolution.value.set(size.width, size.height);
    matRef.current.uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);
    matRef.current.uniforms.uInvView.value.copy(camera.matrixWorld);
    matRef.current.uniforms.uInferenceState.value = infInt;
    matRef.current.uniforms.uScrollProgress.value = scrollProgress;
  });

  return (
    <mesh renderOrder={-2}>
      <planeGeometry args={[2, 2]} />
      <primitive object={volumetricMat} ref={matRef} attach="material" />
    </mesh>
  );
};
