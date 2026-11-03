import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';

const INFERENCE_COLORS: Record<string, THREE.Color> = {
  boot: new THREE.Color(0x000000),
  idle: new THREE.Color(0x0a1628),
  processing: new THREE.Color(0x1a0f00),
  generating: new THREE.Color(0xffffff),
  resolved: new THREE.Color(0x0d1a2d),
};

export const DynamicLighting: React.FC = () => {
  const primaryRef = useRef<THREE.PointLight>(null);
  const secondaryRef = useRef<THREE.PointLight>(null);
  const ambientRef = useRef<THREE.HemisphereLight>(null);

  useFrame(() => {
    const state = useSystemState.getState();

    // Primary light: follows pointer
    if (primaryRef.current) {
      const target = new THREE.Vector3(state.pointer.nx * 6, state.pointer.ny * 4, 2);
      primaryRef.current.position.lerp(target, 0.08);
      // Intensity modulated by pointer speed
      primaryRef.current.intensity = THREE.MathUtils.lerp(
        primaryRef.current.intensity,
        1.5 + state.pointer.speed * 3,
        0.1,
      );
    }

    // Secondary light: orbiting data transfer pulse
    if (secondaryRef.current) {
      const t = state.time * 0.8;
      const radius = 5;
      secondaryRef.current.position.set(
        Math.cos(t) * radius,
        Math.sin(t * 0.7) * radius * 0.5,
        Math.sin(t) * radius,
      );
      // Pulse intensity with server load
      secondaryRef.current.intensity = 0.8 + Math.sin(state.time * 2) * 0.4;
    }

    // Ambient light: shifts with inference state
    if (ambientRef.current) {
      const targetColor = INFERENCE_COLORS[state.inference] || INFERENCE_COLORS.idle;
      ambientRef.current.color.lerp(targetColor, 0.03);
      const targetIntensity = state.inference === 'generating' ? 0.8 : 0.3;
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        targetIntensity,
        0.05,
      );
    }
  });

  return (
    <>
      <pointLight ref={primaryRef} color={0xffffff} intensity={1.5} distance={25} decay={2} />
      <pointLight ref={secondaryRef} color={0x00aaff} intensity={0.8} distance={20} decay={2} />
      <hemisphereLight ref={ambientRef} color={0x0a1628} groundColor={0x000000} intensity={0.3} />
    </>
  );
};
