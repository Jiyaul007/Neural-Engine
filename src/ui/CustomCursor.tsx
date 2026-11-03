import React, { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

export const CustomCursor: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Smooth spring physics for surgical follow lag
  const springX = useSpring(mouseX, { stiffness: 450, damping: 28 });
  const springY = useSpring(mouseY, { stiffness: 450, damping: 28 });

  useEffect(() => {
    // Check if device supports hover (not purely touch)
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const onMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.tagName === 'INPUT' ||
          target.classList.contains('cursor-pointer') ||
          target.closest('button') ||
          target.closest('a') ||
          target.closest('.cursor-pointer'))
      ) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    const onMouseDown = () => {
      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 200);
    };

    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
    };
  }, [isVisible, mouseX, mouseY]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {/* Central pinpoint precision dot */}
      <motion.div
        className="fixed top-0 left-0 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]"
        style={{
          x: mouseX,
          y: mouseY,
        }}
      />

      {/* Lagging precision reticle brackets */}
      <motion.div
        className="fixed top-0 left-0 -ml-4 -mt-4 rounded-full border flex items-center justify-center transition-colors duration-200"
        style={{
          x: springX,
          y: springY,
          width: 32,
          height: 32,
          borderColor: isHovered
            ? 'rgba(0, 240, 255, 0.8)'
            : isClicked
            ? 'rgba(255, 255, 255, 0.9)'
            : 'rgba(255, 255, 255, 0.25)',
          scale: isClicked ? 1.4 : isHovered ? 1.25 : 1,
          boxShadow: isHovered ? '0 0 15px rgba(0, 240, 255, 0.3)' : 'none',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {/* Subtle crosshair tick-marks */}
        <div className="absolute -top-1 w-0.5 h-1 bg-white/40" />
        <div className="absolute -bottom-1 w-0.5 h-1 bg-white/40" />
        <div className="absolute -left-1 w-1 h-0.5 bg-white/40" />
        <div className="absolute -right-1 w-1 h-0.5 bg-white/40" />
      </motion.div>
    </div>
  );
};
