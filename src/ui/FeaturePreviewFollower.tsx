import React, { useEffect } from 'react';
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';
import { useSystemState } from '../engine/SystemState';

const FEATURE_DATA: Record<string, { name: string; desc: string; color: string }> = {
  synthesis: { name: 'NEURAL SYNTHESIS', desc: 'High-realism generative image engine', color: '#00f0ff' },
  aesthetic: { name: 'AESTHETIC MOD', desc: 'Real-time style transfer and refinement', color: '#ff3366' },
  latent: { name: 'LATENT NAVIGATION', desc: 'Explore high-dimensional manifolds', color: '#33ff99' },
  temporal: { name: 'TEMPORAL PROCESSING', desc: 'Video synthesis and prediction', color: '#ffaa00' },
  semantic: { name: 'SEMANTIC ENGINE', desc: 'Vision-language understanding', color: '#aa66ff' },
};

export function FeaturePreviewFollower() {
  const hoveredFeature = useSystemState((state) => state.hoveredFeature);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 150, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX + 20); // Offset slightly so it's not directly under the cursor
      mouseY.set(e.clientY + 20);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  const feature = hoveredFeature ? FEATURE_DATA[hoveredFeature] : null;

  return (
    <AnimatePresence>
      {feature && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            x: springX,
            y: springY,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="w-[200px] h-[120px] rounded-lg overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 flex flex-col justify-end p-4 shadow-2xl"
        >
          {/* Animated gradient visual representing the feature */}
          <motion.div 
            className="absolute inset-0 opacity-20"
            initial={{ backgroundPosition: '0% 0%' }}
            animate={{ backgroundPosition: '100% 100%' }}
            transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
            style={{
              background: `radial-gradient(circle at 50% 50%, ${feature.color}, transparent 70%)`,
              backgroundSize: '200% 200%'
            }}
          />

          {/* Noise overlay */}
          <div 
            className="absolute inset-0 opacity-10 mix-blend-overlay"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'
            }}
          />

          <div className="relative z-10">
            <h3 className="text-white text-xs font-bold tracking-wider mb-1 uppercase" style={{ textShadow: `0 0 10px ${feature.color}` }}>
              {feature.name}
            </h3>
            <p className="text-white/60 text-[10px] leading-tight">
              {feature.desc}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
