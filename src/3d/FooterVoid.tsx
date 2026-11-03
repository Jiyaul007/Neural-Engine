import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';

export function FooterVoid() {
  const sphereRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    const sysState = useSystemState.getState();
    const scroll = sysState.scroll.progress;
    const time = sysState.time;

    const isVisible = scroll >= 0.8;
    if (groupRef.current) {
      groupRef.current.visible = isVisible;
    }

    if (!isVisible) return;

    if (sphereRef.current) {
      const scale = 1.0 + Math.sin(time * 3) * 0.03;
      sphereRef.current.scale.setScalar(scale);
    }

    if (lightRef.current) {
      lightRef.current.intensity = 2 + Math.sin(time * 5) * 1;
    }

    if (scroll > 0.85) {
      const targetFov = THREE.MathUtils.lerp(50, 75, (scroll - 0.85) / 0.15);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.1);
        camera.updateProjectionMatrix();
      }
    }
  });

  return (
    <group ref={groupRef}>
      <Environment preset="night" />
      <mesh ref={sphereRef} position={[0, 0, 0]}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshPhysicalMaterial
          color="#000000"
          metalness={1}
          roughness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.1}
          envMapIntensity={2}
        />
      </mesh>
      <pointLight ref={lightRef} color="#00f0ff" position={[0, 0, 0]} distance={10} intensity={2} />
    </group>
  );
}
