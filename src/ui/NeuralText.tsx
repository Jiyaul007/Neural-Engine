import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import { useSystemState } from '../engine/SystemState';

interface NeuralTextProps {
  text: string;
  className?: string;
  scrambleOnHover?: boolean;
  tag?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*<>{}[]|/\\~^';

export const NeuralText: React.FC<NeuralTextProps> = ({
  text,
  className = '',
  scrambleOnHover = false,
  tag = 'span',
}) => {
  const scrollVelocity = useSystemState((s) => s.scroll.velocity);
  const [displayChars, setDisplayChars] = useState<string[]>(text.split(''));
  const isHovering = useRef(false);
  const scrambleTimer = useRef<number | null>(null);

  // Variable font weight driven by scroll velocity
  const absVel = Math.min(Math.abs(scrollVelocity), 5);
  const targetWeight = absVel > 0.1 ? Math.max(200, 800 - absVel * 150) : 800;
  const targetTracking = absVel > 0.1 ? Math.min(absVel * 3, 8) : 0;

  const weightMV = useMotionValue(800);
  const trackingMV = useMotionValue(0);
  const weightSpring = useSpring(weightMV, { stiffness: 120, damping: 25 });
  const trackingSpring = useSpring(trackingMV, { stiffness: 120, damping: 25 });

  useEffect(() => {
    weightMV.set(targetWeight);
    trackingMV.set(targetTracking);
  }, [targetWeight, targetTracking, weightMV, trackingMV]);

  const [styles, setStyles] = useState({ wght: 800, ls: 0 });
  useEffect(() => {
    const unsub1 = weightSpring.on('change', (v) => setStyles((s) => ({ ...s, wght: Math.round(v) })));
    const unsub2 = trackingSpring.on('change', (v) => setStyles((s) => ({ ...s, ls: v })));
    return () => { unsub1(); unsub2(); };
  }, [weightSpring, trackingSpring]);

  const startScramble = useCallback(() => {
    if (!scrambleOnHover) return;
    isHovering.current = true;
    let iteration = 0;

    const cycle = () => {
      if (!isHovering.current && iteration >= 8) {
        setDisplayChars(text.split(''));
        return;
      }
      setDisplayChars(
        text.split('').map((ch, i) => {
          if (ch === ' ') return ' ';
          // Progressively resolve characters from left to right
          if (i < iteration * (text.length / 12)) return text[i];
          return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        }),
      );
      iteration++;
      if (iteration < 15) {
        scrambleTimer.current = window.setTimeout(cycle, 40);
      } else {
        setDisplayChars(text.split(''));
      }
    };
    cycle();
  }, [text, scrambleOnHover]);

  const stopScramble = useCallback(() => {
    isHovering.current = false;
    if (scrambleTimer.current) clearTimeout(scrambleTimer.current);
    setDisplayChars(text.split(''));
  }, [text]);

  const Tag = tag;

  return (
    <Tag
      className={`neural-text inline-block cursor-default select-none ${className}`}
      onMouseEnter={startScramble}
      onMouseLeave={stopScramble}
      style={{
        fontVariationSettings: `"wght" ${styles.wght}`,
        letterSpacing: `${styles.ls}px`,
        transition: 'font-variation-settings 0.1s ease-out',
      }}
    >
      {displayChars.map((char, i) => (
        <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
          {char}
        </span>
      ))}
    </Tag>
  );
};
