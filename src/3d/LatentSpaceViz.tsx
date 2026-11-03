import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';

// ---------------------------------------------------------------------------
// Concept cluster definitions
// ---------------------------------------------------------------------------
const CONCEPT_CLUSTERS = [
  { id: 'vision',     label: 'VISION',     pos: [2.1,  0.3, -1.4] as [number, number, number], color: '#00f0ff', concepts: ['image', 'pixel', 'render', 'visual', 'perception'] },
  { id: 'language',   label: 'LANGUAGE',   pos: [-1.8, 1.2,  0.7] as [number, number, number], color: '#ff3366', concepts: ['token', 'embed', 'text', 'semantic', 'context'] },
  { id: 'temporal',   label: 'TEMPORAL',   pos: [0.5, -2.1,  1.8] as [number, number, number], color: '#ffaa00', concepts: ['time', 'sequence', 'predict', 'flow', 'motion'] },
  { id: 'spatial',    label: 'SPATIAL',    pos: [-0.8, 0.6, -2.3] as [number, number, number], color: '#33ff99', concepts: ['space', '3d', 'depth', 'geometry', 'transform'] },
  { id: 'synthesis',  label: 'SYNTHESIS',  pos: [1.6, -0.9,  2.1] as [number, number, number], color: '#aa66ff', concepts: ['generate', 'create', 'diffuse', 'noise', 'denoise'] },
  { id: 'attention',  label: 'ATTENTION',  pos: [-2.4,-0.4, -0.6] as [number, number, number], color: '#ff6600', concepts: ['query', 'key', 'value', 'head', 'weight'] },
  { id: 'latent',     label: 'LATENT',     pos: [0.2,  2.4,  0.9] as [number, number, number], color: '#00ccff', concepts: ['manifold', 'embedding', 'compress', 'encode', 'decode'] },
  { id: 'aesthetic',  label: 'AESTHETIC',  pos: [3.0,  1.0,  0.1] as [number, number, number], color: '#ff99cc', concepts: ['style', 'art', 'beauty', 'color', 'compose'] },
  { id: 'inference',  label: 'INFERENCE',  pos: [-1.2,-1.8,  2.6] as [number, number, number], color: '#ccff00', concepts: ['infer', 'predict', 'classify', 'detect', 'reason'] },
  { id: 'memory',     label: 'MEMORY',     pos: [0.9,  0.2, -3.0] as [number, number, number], color: '#ff4444', concepts: ['store', 'retrieve', 'cache', 'context', 'recall'] },
  { id: 'gradient',   label: 'GRADIENT',   pos: [-0.3,-2.8, -1.1] as [number, number, number], color: '#44ffaa', concepts: ['loss', 'optimize', 'backprop', 'learn', 'train'] },
  { id: 'emergence',  label: 'EMERGENCE',  pos: [2.8, -1.5, -2.0] as [number, number, number], color: '#ffdd00', concepts: ['emerge', 'self', 'organize', 'complex', 'pattern'] },
];

const PARTICLES_PER_CLUSTER = 200;
const SIGMA = 0.4;
const CONNECTION_DIST = 3.0;

// ---------------------------------------------------------------------------
// Utility: seeded random Gaussian (Box-Muller)
// ---------------------------------------------------------------------------
function gaussRand(mu: number, sigma: number, rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mu + sigma * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Simple LCG seeded random
function makeLCG(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// ---------------------------------------------------------------------------
// Point cloud shader material (inline GLSL)
// ---------------------------------------------------------------------------
const POINT_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aClusterIndex;

  uniform float uTime;
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;

  // Curl-noise helpers
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    return mix(mix(mix(hash(n), hash(n+1.0), f.x),
                   mix(hash(n+57.0), hash(n+58.0), f.x), f.y),
               mix(mix(hash(n+113.0), hash(n+114.0), f.x),
                   mix(hash(n+170.0), hash(n+171.0), f.x), f.y), f.z);
  }

  void main() {
    vec3 pos = position;

    // Small curl-noise displacement
    float n1 = noise(pos * 2.3 + vec3(uTime * 0.12, 0.0, 0.0));
    float n2 = noise(pos * 2.3 + vec3(0.0, uTime * 0.12, 0.0));
    float n3 = noise(pos * 2.3 + vec3(0.0, 0.0, uTime * 0.12));
    pos += vec3(n1, n2, n3) * 0.04;

    // Oscillate y per particle (aClusterIndex used as per-particle seed)
    pos.y += sin(uTime * 0.8 + aClusterIndex * 1.618) * 0.025;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Point size decreases with distance
    gl_PointSize = clamp(3.5 / -mvPos.z, 1.0, 5.5);

    vColor = aColor;
    vAlpha = uOpacity;
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Soft glowing disc
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;
    float alpha = (1.0 - r * 2.0);
    alpha = alpha * alpha;
    gl_FragColor = vec4(vColor, alpha * vAlpha);
  }
`;

// ---------------------------------------------------------------------------
// Connection arc shader (dashed animated tube)
// ---------------------------------------------------------------------------
const ARC_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3  uColor;

  varying vec2 vUv;

  void main() {
    float dash = fract(vUv.x * 15.0 - uTime * 1.5);
    float alpha = step(0.4, dash) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Pre-compute which clusters are connected
// ---------------------------------------------------------------------------
const CONNECTIONS: Array<{ a: number; b: number; color: THREE.Color }> = [];
for (let i = 0; i < CONCEPT_CLUSTERS.length; i++) {
  for (let j = i + 1; j < CONCEPT_CLUSTERS.length; j++) {
    const pa = new THREE.Vector3(...CONCEPT_CLUSTERS[i].pos);
    const pb = new THREE.Vector3(...CONCEPT_CLUSTERS[j].pos);
    if (pa.distanceTo(pb) <= CONNECTION_DIST) {
      // Blend colors
      const ca = new THREE.Color(CONCEPT_CLUSTERS[i].color);
      const cb = new THREE.Color(CONCEPT_CLUSTERS[j].color);
      const blended = ca.clone().lerp(cb, 0.5);
      CONNECTIONS.push({ a: i, b: j, color: blended });
    }
  }
}

// ---------------------------------------------------------------------------
// Token particle type
// ---------------------------------------------------------------------------
interface TokenParticle {
  id: number;
  curve: THREE.CubicBezierCurve3;
  t: number;            // 0 → 1 progress
  duration: number;     // seconds
  targetCluster: number;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Sub-component: the particle point cloud
// ---------------------------------------------------------------------------
const PointCloud: React.FC<{ globalOpacity: number }> = ({ globalOpacity }) => {
  const meshRef = useRef<THREE.Points>(null!);
  const matRef  = useRef<THREE.ShaderMaterial>(null!);

  const { positions, colors, indices } = useMemo(() => {
    const total = CONCEPT_CLUSTERS.length * PARTICLES_PER_CLUSTER;
    const positions = new Float32Array(total * 3);
    const colors    = new Float32Array(total * 3);
    const indices   = new Float32Array(total);

    let idx = 0;
    CONCEPT_CLUSTERS.forEach((cluster, ci) => {
      const rng = makeLCG(ci * 31337 + 42);
      const col = new THREE.Color(cluster.color);
      for (let p = 0; p < PARTICLES_PER_CLUSTER; p++) {
        positions[idx * 3]     = gaussRand(cluster.pos[0], SIGMA, rng);
        positions[idx * 3 + 1] = gaussRand(cluster.pos[1], SIGMA, rng);
        positions[idx * 3 + 2] = gaussRand(cluster.pos[2], SIGMA, rng);
        colors[idx * 3]     = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;
        indices[idx] = idx; // used as per-particle seed in vert shader
        idx++;
      }
    });
    return { positions, colors, indices };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',      new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor',        new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aClusterIndex', new THREE.BufferAttribute(indices, 1));
    return geo;
  }, [positions, colors, indices]);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader:   POINT_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: {
        uTime:    { value: 0 },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    matRef.current = mat;
    return mat;
  }, []);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value    = clock.elapsedTime;
    matRef.current.uniforms.uOpacity.value = globalOpacity;
  });

  return <points ref={meshRef} geometry={geometry} material={material} />;
};

// ---------------------------------------------------------------------------
// Sub-component: connection arc between two clusters
// ---------------------------------------------------------------------------
const ConnectionArc: React.FC<{
  aIdx: number;
  bIdx: number;
  color: THREE.Color;
  hoveredCluster: string | null;
  globalOpacity: number;
}> = ({ aIdx, bIdx, color, hoveredCluster, globalOpacity }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const { geometry } = useMemo(() => {
    const pa = new THREE.Vector3(...CONCEPT_CLUSTERS[aIdx].pos);
    const pb = new THREE.Vector3(...CONCEPT_CLUSTERS[bIdx].pos);
    const mid = pa.clone().lerp(pb, 0.5);
    // Arc control points — lift the midpoint outward
    const lift = pa.clone().cross(pb).normalize().multiplyScalar(0.6);
    const cp1 = mid.clone().add(lift);
    const cp2 = mid.clone().sub(lift);

    const curve = new THREE.CubicBezierCurve3(pa, cp1, cp2, pb);
    const tube  = new THREE.TubeGeometry(curve, 30, 0.008, 4, false);
    return { geometry: tube };
  }, [aIdx, bIdx]);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader:   ARC_VERT,
      fragmentShader: ARC_FRAG,
      uniforms: {
        uTime:    { value: 0 },
        uOpacity: { value: 0.15 },
        uColor:   { value: color },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      side:        THREE.DoubleSide,
    });
    matRef.current = mat;
    return mat;
  }, [color]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;

    const aId = CONCEPT_CLUSTERS[aIdx].id;
    const bId = CONCEPT_CLUSTERS[bIdx].id;
    const hovered = hoveredCluster === aId || hoveredCluster === bId;
    const targetOp = hovered ? 0.6 * globalOpacity : 0.15 * globalOpacity;
    matRef.current.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      matRef.current.uniforms.uOpacity.value, targetOp, 0.08
    );
  });

  return <mesh geometry={geometry} material={material} />;
};

// ---------------------------------------------------------------------------
// Sub-component: single flying token particle
// ---------------------------------------------------------------------------
const TokenBead: React.FC<{ token: TokenParticle; clusterPulse: (ci: number) => void }> = ({ token, clusterPulse }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef  = useRef<THREE.MeshBasicMaterial>(null!);
  const pulseFired = useRef(false);

  const color = CONCEPT_CLUSTERS[token.targetCluster].color;

  useFrame((_state, delta) => {
    if (token.done) return;
    token.t += delta / token.duration;
    if (token.t >= 1.0) {
      token.t = 1.0;
      token.done = true;
      if (!pulseFired.current) {
        pulseFired.current = true;
        clusterPulse(token.targetCluster);
      }
    }
    const pt = token.curve.getPoint(token.t);
    if (meshRef.current) meshRef.current.position.copy(pt);
    if (matRef.current) matRef.current.opacity = token.done ? 0 : 1 - token.t * 0.3;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.03, 6, 6]} />
      <meshBasicMaterial ref={matRef} color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: cluster label
// ---------------------------------------------------------------------------
const ClusterLabel: React.FC<{
  cluster: typeof CONCEPT_CLUSTERS[number];
  onHover: (id: string | null) => void;
  pulseAmount: number;
}> = ({ cluster, onHover, pulseAmount }) => {
  const { camera } = useThree();
  const [visible, setVisible] = useState(true);
  const posVec = useMemo(() => new THREE.Vector3(...cluster.pos), [cluster.pos]);

  useFrame(() => {
    const dist = camera.position.distanceTo(posVec);
    setVisible(dist < 18);
  });

  if (!visible) return null;

  const scale = 1 + pulseAmount * 0.4;

  return (
    <Html
      position={cluster.pos}
      distanceFactor={8}
      center
      style={{ pointerEvents: 'auto' }}
    >
      <span
        onPointerOver={() => onHover(cluster.id)}
        onPointerOut={() => onHover(null)}
        style={{
          fontFamily: 'monospace',
          fontSize: '9px',
          letterSpacing: '0.15em',
          color: cluster.color,
          textTransform: 'uppercase',
          userSelect: 'none',
          cursor: 'default',
          transform: `scale(${scale})`,
          display: 'inline-block',
          textShadow: `0 0 8px ${cluster.color}`,
          opacity: 0.85 + pulseAmount * 0.15,
          transition: 'transform 0.1s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {cluster.label}
      </span>
    </Html>
  );
};

// ---------------------------------------------------------------------------
// Main LatentSpaceViz component
// ---------------------------------------------------------------------------
export const LatentSpaceViz: React.FC = () => {
  const inference      = useSystemState((s) => s.inference);
  const scrollProgress = useSystemState((s) => s.scroll.progress);
  const setHovered     = useSystemState((s) => s.setHoveredFeature);

  const groupRef        = useRef<THREE.Group>(null!);
  const opacityRef      = useRef(0);
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);
  const [tokens, setTokens]   = useState<TokenParticle[]>([]);
  const [pulseCounts, setPulseCounts] = useState<number[]>(new Array(CONCEPT_CLUSTERS.length).fill(0));
  const pulseTimes = useRef<number[]>(new Array(CONCEPT_CLUSTERS.length).fill(0));
  const tokenIdRef  = useRef(0);
  const prevInference = useRef<string>(inference);
  const { camera } = useThree();

  // Visibility band: 30% – 75% scroll
  const targetOpacity = scrollProgress >= 0.30 && scrollProgress <= 0.75 ? 1.0 : 0.0;

  // Watch for 'generating' transition → spawn tokens
  useEffect(() => {
    if (prevInference.current !== 'generating' && inference === 'generating') {
      const count = 8 + Math.floor(Math.random() * 8); // 8..15
      const newTokens: TokenParticle[] = [];
      for (let i = 0; i < count; i++) {
        const targetCI = Math.floor(Math.random() * CONCEPT_CLUSTERS.length);
        const target   = new THREE.Vector3(...CONCEPT_CLUSTERS[targetCI].pos);
        const origin   = camera.position.clone().multiplyScalar(0.15); // near camera center
        // Random bezier control points
        const cp1 = origin.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4
        ));
        const cp2 = target.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2
        ));
        newTokens.push({
          id: tokenIdRef.current++,
          curve: new THREE.CubicBezierCurve3(origin, cp1, cp2, target),
          t: 0,
          duration: 1.2 + Math.random() * 0.6,
          targetCluster: targetCI,
          done: false,
        });
      }
      setTokens(prev => [...prev.filter(t => !t.done), ...newTokens]);
    }
    prevInference.current = inference;
  }, [inference, camera]);

  // Clean up finished tokens periodically
  useEffect(() => {
    const id = setInterval(() => {
      setTokens(prev => prev.filter(t => !t.done));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const handleClusterPulse = (ci: number) => {
    pulseTimes.current[ci] = performance.now();
    setPulseCounts(prev => {
      const next = [...prev];
      next[ci]++;
      return next;
    });
  };

  const handleHover = (id: string | null) => {
    setHoveredCluster(id);
    setHovered(id);
  };

  // Pulse amounts per cluster (decay over 800ms)
  const [pulseAmounts, setPulseAmounts] = useState<number[]>(new Array(CONCEPT_CLUSTERS.length).fill(0));

  useFrame((_state, delta) => {
    // Animate global opacity
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 2.5);
    if (groupRef.current) {
      groupRef.current.visible = opacityRef.current > 0.01;
    }

    // Decay pulse amounts
    const now = performance.now();
    setPulseAmounts(prev => {
      const next = [...prev];
      for (let i = 0; i < next.length; i++) {
        const elapsed = (now - pulseTimes.current[i]) / 800;
        next[i] = Math.max(0, 1 - elapsed);
      }
      return next;
    });
  });

  return (
    <group ref={groupRef} scale={[0.7, 0.7, 0.7]}>
      {/* Particle point cloud */}
      <PointCloud globalOpacity={opacityRef.current} />

      {/* Connection arcs */}
      {CONNECTIONS.map((conn, i) => (
        <ConnectionArc
          key={i}
          aIdx={conn.a}
          bIdx={conn.b}
          color={conn.color}
          hoveredCluster={hoveredCluster}
          globalOpacity={opacityRef.current}
        />
      ))}

      {/* Cluster labels */}
      {CONCEPT_CLUSTERS.map((cluster, i) => (
        <ClusterLabel
          key={cluster.id}
          cluster={cluster}
          onHover={handleHover}
          pulseAmount={pulseAmounts[i]}
        />
      ))}

      {/* Flying token particles */}
      {tokens.map(token => (
        <TokenBead key={token.id} token={token} clusterPulse={handleClusterPulse} />
      ))}
    </group>
  );
};
