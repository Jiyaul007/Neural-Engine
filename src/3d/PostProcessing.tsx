import React, { useMemo } from 'react';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';

export const PostProcessing: React.FC = () => {
  const inference = useSystemState((s) => s.inference);
  const scrollVelocity = useSystemState((s) => s.scroll.velocity);

  const bloomIntensity = inference === 'generating' ? 2.4 : inference === 'processing' ? 1.6 : 1.1;

  // Kinetic chromatic aberration driven by scroll velocity & inference turbulence
  const caOffset = useMemo(() => {
    const amount = Math.min(Math.abs(scrollVelocity) * 0.003 + 0.0006, 0.006);
    return new THREE.Vector2(amount, amount);
  }, [scrollVelocity]);

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        intensity={bloomIntensity}
        mipmapBlur
        luminanceThreshold={0.55}
        luminanceSmoothing={0.35}
        radius={0.75}
      />
      <ChromaticAberration
        offset={caOffset}
        radialModulation={true}
        modulationOffset={0.25}
      />
      <Noise opacity={0.035} />
      <Vignette
        eskil={false}
        offset={0.12}
        darkness={0.75}
      />
    </EffectComposer>
  );
};
