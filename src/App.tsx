import React, { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LenisProvider } from './providers/LenisProvider';
import { BootSequence } from './sequences/BootSequence';
import { SceneCanvas } from './3d/SceneCanvas';
import { MicroDataUI } from './ui/MicroDataUI';
import { HeroHeadline } from './ui/HeroHeadline';
import { ScrollSections } from './ui/ScrollSections';
import { FeaturePreviewFollower } from './ui/FeaturePreviewFollower';
import { CustomCursor } from './ui/CustomCursor';
import { InferenceTerminalModal } from './ui/InferenceTerminalModal';
import { StreamingTokenVisualizer } from './ui/StreamingTokenVisualizer';
import { useSystemState } from './engine/SystemState';
import { usePointerVelocity } from './hooks/usePointerVelocity';
import { useWebGPUSupport } from './hooks/useWebGPUSupport';
import { useNeuralSocket } from './engine/useNeuralSocket';

gsap.registerPlugin(ScrollTrigger);

const ScrollWatcher: React.FC = () => {
  const setScroll = useSystemState((s) => s.setScroll);

  useLayoutEffect(() => {
    const st = ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        setScroll(self.progress, self.getVelocity() / 1000);
      },
    });
    return () => { st.kill(); };
  }, [setScroll]);

  return null;
};

const PointerWatcher: React.FC = () => {
  usePointerVelocity();
  return null;
};

const GPUDetector: React.FC = () => {
  useWebGPUSupport();
  return null;
};

const SocketWatcher: React.FC = () => {
  useNeuralSocket();
  return null;
};

const App: React.FC = () => {
  return (
    <LenisProvider>
      {/* System hooks — no render output */}
      <PointerWatcher />
      <ScrollWatcher />
      <GPUDetector />
      <SocketWatcher />

      {/* Boot sequence overlay — z-50, above everything */}
      <BootSequence />

      {/* 3D Canvas — fixed, behind DOM */}
      <SceneCanvas />

      {/* Fixed overlays — above canvas, below scroll content */}
      <CustomCursor />
      <MicroDataUI />
      <HeroHeadline />
      <FeaturePreviewFollower />

      {/* Interactive Neural Command Modal */}
      <InferenceTerminalModal />

      {/* Real-time Streaming Token Visualizer */}
      <StreamingTokenVisualizer />

      {/* Scrollable DOM content — drives the entire experience */}
      <ScrollSections />
    </LenisProvider>
  );
};

export default App;
