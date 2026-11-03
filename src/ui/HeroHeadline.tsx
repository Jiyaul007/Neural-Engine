import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { NeuralText } from './NeuralText';
import { useSystemState } from '../engine/SystemState';

export const HeroHeadline: React.FC = () => {
  const scrollProgress = useSystemState((s) => s.scroll.progress);
  const inference = useSystemState((s) => s.inference);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (inference === 'idle' || inference === 'resolved') {
      setVisible(true);
    }
  }, [inference]);

  // Fade out as user scrolls past initialization phase (0-15%)
  const opacity = Math.max(0, 1 - scrollProgress / 0.15);
  const yOffset = scrollProgress * 400;

  if (!visible) return null;

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      style={{ opacity, transform: `translateY(-${yOffset}px)` }}
    >
      <div className="text-center text-white mix-blend-difference flex flex-col items-center gap-0">
        <NeuralText
          text="THE"
          tag="h1"
          className="text-[8vw] md:text-[6vw] font-black leading-[0.85] tracking-[-0.04em]"
          scrambleOnHover
        />
        <NeuralText
          text="NEURAL"
          tag="h1"
          className="text-[16vw] md:text-[12vw] font-black leading-[0.85] tracking-[-0.04em]"
          scrambleOnHover
        />
        <NeuralText
          text="ENGINE"
          tag="h1"
          className="text-[16vw] md:text-[12vw] font-black leading-[0.85] tracking-[-0.04em]"
          scrambleOnHover
        />
      </div>
    </motion.div>
  );
};
