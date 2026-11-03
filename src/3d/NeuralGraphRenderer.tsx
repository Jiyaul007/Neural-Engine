import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';

interface NodeData {
  layer: number;
  pos: THREE.Vector3;
  baseColor: THREE.Color;
}

export const NeuralGraphRenderer: React.FC = () => {
  const inference = useSystemState((s) => s.inference);
  const scrollProgress = useSystemState((s) => s.scroll.progress);

  const groupRef = useRef<THREE.Group>(null);
  const instancedNodesRef = useRef<THREE.InstancedMesh>(null);
  const linesMeshRef = useRef<THREE.LineSegments>(null);

  // Layer layout configuration: 6 layers, 64 nodes
  const LAYER_SIZES = [8, 16, 12, 16, 8, 4];
  const LAYER_Z = [-3.5, -2.1, -0.7, 0.7, 2.1, 3.5];

  const LAYER_COLORS = [
    new THREE.Color('#00f0ff'), // Cyan
    new THREE.Color('#00aaff'), // Sky Blue
    new THREE.Color('#ff00aa'), // Magenta / Attention
    new THREE.Color('#aa44ff'), // Purple / FFN
    new THREE.Color('#33ff99'), // Green / Projection
    new THREE.Color('#ffaa00'), // Amber / Output
  ];

  // Generate 64 nodes
  const nodes = useMemo<NodeData[]>(() => {
    const list: NodeData[] = [];
    LAYER_SIZES.forEach((count, lIdx) => {
      const z = LAYER_Z[lIdx];
      const color = LAYER_COLORS[lIdx];

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 1.2 + 0.3 * Math.sin(lIdx + i);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        list.push({
          layer: lIdx,
          pos: new THREE.Vector3(x, y, z),
          baseColor: color,
        });
      }
    });
    return list;
  }, []);

  // Generate sparse graph edges between consecutive layers
  const [edgePositions, edgeColors, edgePairs] = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const pairs: { src: number; dst: number }[] = [];

    let layerStartIdx = 0;
    for (let l = 0; l < LAYER_SIZES.length - 1; l++) {
      const currentCount = LAYER_SIZES[l];
      const nextCount = LAYER_SIZES[l + 1];
      const nextStartIdx = layerStartIdx + currentCount;

      for (let i = 0; i < currentCount; i++) {
        const srcIdx = layerStartIdx + i;
        // Connect to ~3-4 nodes in next layer
        const connections = 3;
        for (let c = 0; c < connections; c++) {
          const dstOffset = (i + c * 2) % nextCount;
          const dstIdx = nextStartIdx + dstOffset;

          const p1 = nodes[srcIdx].pos;
          const p2 = nodes[dstIdx].pos;

          positions.push(p1.x, p1.y, p1.z);
          positions.push(p2.x, p2.y, p2.z);

          colors.push(0.05, 0.1, 0.2); // Inactive dim color
          colors.push(0.05, 0.1, 0.2);

          pairs.push({ src: srcIdx, dst: dstIdx });
        }
      }
      layerStartIdx += currentCount;
    }

    return [
      new Float32Array(positions),
      new Float32Array(colors),
      pairs,
    ];
  }, [nodes]);

  // Set up instanced mesh transforms
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useMemo(() => {
    // Just a placeholder to ensure dummy is initialized
  }, [dummy]);

  useFrame((state) => {
    if (!groupRef.current) return;

    // Visibility window: scroll 0.12 to 0.72
    const isVisible = scrollProgress >= 0.12 && scrollProgress <= 0.72;
    groupRef.current.visible = isVisible;
    if (!isVisible) return;

    // Fade opacity based on scroll
    let opacity = 1.0;
    if (scrollProgress < 0.22) {
      opacity = (scrollProgress - 0.12) / 0.10;
    } else if (scrollProgress > 0.62) {
      opacity = 1.0 - (scrollProgress - 0.62) / 0.10;
    }
    opacity = Math.max(0, Math.min(1, opacity));

    const t = state.clock.getElapsedTime();
    const waveFreq = inference === 'generating' ? 3.2 : 1.1;
    const waveLayer = (t * waveFreq) % 6;

    // Rotate the graph slightly
    groupRef.current.rotation.y = t * 0.15;
    groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;

    // Update nodes
    if (instancedNodesRef.current) {
      const mesh = instancedNodesRef.current;
      const colorHelper = new THREE.Color();

      nodes.forEach((node, i) => {
        dummy.position.copy(node.pos);
        const distToWave = Math.abs(node.layer - waveLayer);
        const activation = Math.exp(-distToWave * distToWave * 2.2);
        const scale = 0.8 + activation * 0.8;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Modulate color brightness by activation & overall opacity
        colorHelper.copy(node.baseColor).multiplyScalar((0.3 + activation * 2.5) * opacity);
        mesh.setColorAt(i, colorHelper);
      });

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Update edge lines
    if (linesMeshRef.current) {
      const colorAttr = linesMeshRef.current.geometry.attributes.color as THREE.BufferAttribute;
      const colorArray = colorAttr.array as Float32Array;

      edgePairs.forEach((pair, idx) => {
        const srcNode = nodes[pair.src];
        const distToWave = Math.abs(srcNode.layer - waveLayer);
        const pulse = Math.exp(-distToWave * distToWave * 2.5) * opacity;

        const baseIdx = idx * 6;
        const c = srcNode.baseColor;

        // Source vertex
        colorArray[baseIdx + 0] = THREE.MathUtils.lerp(0.04, c.r, pulse);
        colorArray[baseIdx + 1] = THREE.MathUtils.lerp(0.08, c.g, pulse);
        colorArray[baseIdx + 2] = THREE.MathUtils.lerp(0.15, c.b, pulse);

        // Destination vertex
        colorArray[baseIdx + 3] = THREE.MathUtils.lerp(0.04, c.r * 0.7, pulse);
        colorArray[baseIdx + 4] = THREE.MathUtils.lerp(0.08, c.g * 0.7, pulse);
        colorArray[baseIdx + 5] = THREE.MathUtils.lerp(0.15, c.b * 0.7, pulse);
      });

      colorAttr.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} renderOrder={-1} scale={[0.85, 0.85, 0.85]}>
      {/* 64 Nodes via single InstancedMesh */}
      <instancedMesh
        ref={instancedNodesRef}
        args={[undefined, undefined, nodes.length]}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Sparse connectivity lines */}
      <lineSegments ref={linesMeshRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[edgePositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[edgeColors, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.65} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
};
