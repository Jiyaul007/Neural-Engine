import React, { Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';
import { NeuralCore } from './NeuralCore';
import { LatentSpaceViz } from './LatentSpaceViz';
import { NeuralGraphRenderer } from './NeuralGraphRenderer';
import { FluidDistortion } from './FluidDistortion';
import { SpatialDashboard } from './SpatialDashboard';
import { FooterVoid } from './FooterVoid';
import { DynamicLighting } from './DynamicLighting';
import { PostProcessing } from './PostProcessing';
import { CoreShatter } from '../sequences/CoreShatter';

const SystemTick: React.FC = () => {
  const tick = useSystemState((s) => s.tick);
  useFrame(({ clock }) => {
    tick(clock.getElapsedTime(), clock.getDelta());
  });
  return null;
};

const CameraController: React.FC = () => {
  const cameraMode = useSystemState((s) => s.cameraMode);

  if (cameraMode === 'orbit') {
    return (
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        maxDistance={40}
        minDistance={2}
      />
    );
  }

  return null;
};

export const SceneCanvas: React.FC = () => {
  const cameraMode = useSystemState((s) => s.cameraMode);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{
          pointerEvents: cameraMode === 'orbit' ? 'auto' : 'none',
        }}
      >
        <color attach="background" args={['#000000']} />
        <Suspense fallback={null}>
          <SystemTick />
          <CameraController />

          {/* Lighting system */}
          <DynamicLighting />

          {/* Background fluid distortion layer */}
          <FluidDistortion />

          {/* Hero: High-fidelity GPU particle swarm */}
          <NeuralCore />

          {/* Live DAG Neural Network Graph */}
          <NeuralGraphRenderer />

          {/* 3D Latent Space semantic clusters */}
          <LatentSpaceViz />

          {/* Scroll-driven state controller for the shatter transition */}
          {cameraMode === 'cinematic' && <CoreShatter />}

          {/* 3D spatial dashboard with floating panels */}
          <SpatialDashboard />

          {/* Footer chrome sphere */}
          <FooterVoid />

          {/* Post-processing effects */}
          <PostProcessing />
        </Suspense>
      </Canvas>
    </div>
  );
};
