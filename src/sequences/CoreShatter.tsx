import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';
import { neuralAudio } from '../audio/NeuralAudio';
import { useRef } from 'react';

export function CoreShatter() {
  const { camera } = useThree();
  const setInference = useSystemState((s) => s.setInference);
  const playedBoomRef = useRef(false);

  useFrame(() => {
    const state = useSystemState.getState();
    const scroll = state.scroll.progress;
    
    // Manage inference state based on scroll thresholds
    if (scroll >= 0.15 && scroll < 0.20 && state.inference !== 'processing') {
      setInference('processing');
      if (!playedBoomRef.current) {
        neuralAudio.playShatterBoom();
        playedBoomRef.current = true;
      }
    } else if (scroll >= 0.20 && scroll < 0.30 && state.inference !== 'generating') {
      setInference('generating');
    } else if (scroll >= 0.30 && scroll < 0.35 && state.inference !== 'resolved') {
      setInference('resolved');
    } else if (scroll < 0.15 && state.inference !== 'idle') {
      setInference('idle');
      playedBoomRef.current = false;
    }

    // Map progress 0.15-0.35 to shatter phase 0-1
    let shatterProgress = 0;
    if (scroll >= 0.15 && scroll <= 0.35) {
      shatterProgress = (scroll - 0.15) / 0.20;
    }

    // Camera FOV control
    if (camera instanceof THREE.PerspectiveCamera) {
      if (scroll >= 0.15 && scroll <= 0.35) {
        // Narrows during shatter (progress < 0.5), widens during reorganization (progress > 0.5)
        const targetFov = shatterProgress < 0.5 
          ? THREE.MathUtils.lerp(50, 35, shatterProgress * 2)
          : THREE.MathUtils.lerp(35, 50, (shatterProgress - 0.5) * 2);
        
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.1);
        camera.updateProjectionMatrix();
      } else if (scroll < 0.15 || (scroll > 0.35 && scroll < 0.8)) {
        // Reset to default FOV 50 smoothly, unless handled by FooterVoid (scroll > 0.8)
        camera.fov = THREE.MathUtils.lerp(camera.fov, 50, 0.1);
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}
