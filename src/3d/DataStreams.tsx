import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSystemState } from '../engine/SystemState';

const StreamShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#00f0ff') },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float dash = fract(vUv.x * 20.0 - uTime * 2.0);
      float alpha = step(0.5, dash) * 0.5;
      float pulse = 0.5 + 0.5 * sin(uTime * 5.0 + vUv.x * 10.0);
      gl_FragColor = vec4(uColor * pulse, alpha * 0.2);
    }
  `,
};

export function DataStreams({ positions, colors }: { positions: THREE.Vector3[], colors: string[] }) {
  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);
  
  const tubes = useMemo(() => {
    const meshes = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        // Connect neighbors
        if (Math.abs(i - j) === 1 || (i === 0 && j === positions.length - 1)) {
           const curve = new THREE.CatmullRomCurve3([
             positions[i],
             positions[i].clone().lerp(positions[j], 0.5).add(new THREE.Vector3(0, 0, (i%2 === 0 ? 1 : -1) * 2)),
             positions[j]
           ]);
           meshes.push({
             curve,
             color: colors[i]
           });
        }
      }
    }
    return meshes;
  }, [positions, colors]);

  useFrame(() => {
    const sysState = useSystemState.getState();
    const time = sysState.time;
    materialsRef.current.forEach(mat => {
      if (mat) mat.uniforms.uTime.value = time;
    });
  });

  return (
    <group>
      {tubes.map((tube, i) => (
        <mesh key={i}>
          <tubeGeometry args={[tube.curve, 64, 0.05, 8, false]} />
          <shaderMaterial 
            ref={(el) => { if (el) materialsRef.current[i] = el; }}
            transparent 
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={{
              uTime: { value: 0 },
              uColor: { value: new THREE.Color(tube.color) },
            }}
            vertexShader={StreamShaderMaterial.vertexShader}
            fragmentShader={StreamShaderMaterial.fragmentShader}
          />
        </mesh>
      ))}
    </group>
  );
}
