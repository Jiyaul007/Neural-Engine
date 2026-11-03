import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useSystemState } from '../engine/SystemState';

export const BootSequence: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLDivElement>(null);
  
  const setInference = useSystemState((s) => s.setInference);
  const setBootComplete = useSystemState((s) => s.setBootComplete);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !pulseRef.current || !coordsRef.current) return;

    const tl = gsap.timeline({
      onComplete: () => {
        setBootComplete(true);
        setIsDone(true);
      },
    });

    // 0–0.3s: Pure black void
    tl.set(containerRef.current, { opacity: 1 });

    // 0.3–1.0s: Coordinates typewriter fade-in at corners
    tl.fromTo(
      coordsRef.current.children,
      { opacity: 0, y: 5 },
      { opacity: 0.5, y: 0, duration: 0.4, stagger: 0.15, ease: 'power2.out' },
      0.3,
    );

    // 1.0–1.5s: Pulse ring expands from center
    tl.set(pulseRef.current, { opacity: 0.6, scale: 0 }, 1.0);
    tl.to(pulseRef.current, {
      scale: 80,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    }, 1.0);

    // 1.5s: Signal particles to ignite
    tl.add(() => setInference('processing'), 1.5);

    // 2.5s: Signal particles to snap to formation
    tl.add(() => setInference('generating'), 2.5);

    // 3.5s: Light sweep (handled by 3D scene via inference state)

    // 4.0s: Set idle — hero headline appears
    tl.add(() => setInference('idle'), 4.0);

    // 4.0–5.0s: Fade out boot overlay
    tl.to(containerRef.current, {
      opacity: 0,
      duration: 1.0,
      ease: 'power2.inOut',
    }, 4.0);

    return () => { tl.kill(); };
  }, [setInference, setBootComplete]);

  if (isDone) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      style={{ pointerEvents: 'none' }}
    >
      {/* Pulse ring */}
      <div
        ref={pulseRef}
        className="absolute rounded-full opacity-0"
        style={{
          width: '4px',
          height: '4px',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          boxShadow: '0 0 20px rgba(0, 240, 255, 0.15)',
        }}
      />

      {/* Corner coordinates */}
      <div ref={coordsRef} className="absolute inset-0 font-mono text-[9px] uppercase tracking-[0.15em] text-[#333]">
        <div className="absolute top-4 left-4">[BOOT.SEQ_INIT]</div>
        <div className="absolute top-4 right-4">CORE.v4.2.1</div>
        <div className="absolute bottom-4 left-4">NODE_0x00FF</div>
        <div className="absolute bottom-4 right-4">LATENT.SPACE.READY</div>
      </div>
    </div>
  );
};
