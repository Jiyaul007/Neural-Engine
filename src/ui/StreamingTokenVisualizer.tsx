import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSystemState } from '../engine/SystemState';

// ── Types ────────────────────────────────────────────────────────────────────

interface WaveformBarProps {
  index: number;
  total: number;
  settled: boolean;
}

// ── Waveform Bar (spectrum analyzer) ─────────────────────────────────────────

const WaveformBars: React.FC<{ settled: boolean }> = ({ settled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const settleFactor = useRef<number>(1); // 1 = full animation, 0 = flat line

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BAR_COUNT = 32;
    let startTime = performance.now();

    // Settle animation: smoothly reduce settleFactor to 0 over 2 seconds
    if (settled) {
      const settleStart = performance.now();
      const SETTLE_DURATION = 2000;
      const settleRaf = () => {
        const elapsed = performance.now() - settleStart;
        settleFactor.current = Math.max(0, 1 - elapsed / SETTLE_DURATION);
        if (settleFactor.current > 0) {
          requestAnimationFrame(settleRaf);
        }
      };
      requestAnimationFrame(settleRaf);
    } else {
      settleFactor.current = 1;
    }

    const draw = () => {
      const now = performance.now();
      const t = (now - startTime) / 1000;

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      const barWidth = (W / BAR_COUNT) - 1;

      for (let i = 0; i < BAR_COUNT; i++) {
        const norm = i / BAR_COUNT;

        // Multi-frequency sine composition for organic motion
        const height =
          (Math.sin(t * 3.1 + norm * 8.4) * 0.35 +
           Math.sin(t * 5.7 + norm * 4.2) * 0.25 +
           Math.sin(t * 2.3 + norm * 12.1) * 0.20 +
           Math.sin(t * 7.9 + norm * 2.6) * 0.10 +
           (Math.random() - 0.5) * 0.10) * settleFactor.current;

        // Normalize 0–1
        const barH = Math.max(1, ((height + 1) / 2) * (H - 2) + 1);
        const x = i * (barWidth + 1);
        const y = H - barH;

        // Cyan → magenta gradient based on height
        const heightRatio = barH / H;
        const r = Math.round(0 + heightRatio * 255);
        const g = Math.round(240 - heightRatio * 240);
        const b = 255;
        const alpha = 0.6 + heightRatio * 0.4;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(x, y, barWidth, barH);

        // Glow cap on top
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
        ctx.fillRect(x, y, barWidth, 2);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [settled]);

  return (
    <canvas
      ref={canvasRef}
      width={596}
      height={36}
      style={{ display: 'block', width: '100%', height: 36 }}
    />
  );
};

// ── Token chip ────────────────────────────────────────────────────────────────

const TokenChip: React.FC<{ token: string; index: number; total: number }> = ({
  token,
  index,
  total,
}) => {
  // Older tokens become more transparent
  const age = total - 1 - index; // 0 = newest
  const opacity = Math.max(0.2, 1 - age * (0.8 / Math.max(1, total - 1)));

  return (
    <motion.span
      layout
      initial={{ opacity: 0, x: 20, scale: 0.85 }}
      animate={{ opacity, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{
        display: 'inline-block',
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: 11,
        color: `rgba(0, 240, 255, ${opacity})`,
        textShadow: `0 0 8px rgba(0, 240, 255, ${opacity * 0.8})`,
        padding: '2px 6px',
        marginRight: 4,
        borderRadius: 3,
        background: `rgba(0, 240, 255, ${opacity * 0.06})`,
        border: `1px solid rgba(0, 240, 255, ${opacity * 0.15})`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {token}
    </motion.span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const FAKE_TOKENS = [
  'neural',   'latent',   'manifold', 'diffuse',   'embed',
  'query',    'attention','vector',   'gradient',  'sigmoid',
  'softmax',  'logit',    'weight',   'bias',      'layer',
  'norm',     'residual', 'proj',     'head',      'token',
  'encode',   'decode',   'cross',    'self',      'mask',
  'pad',      'context',  'hidden',   'ffn',       'rope',
  'scale',    'dot',      'value',    'key',       'flash',
];

export const StreamingTokenVisualizer: React.FC = () => {
  const inference = useSystemState((s) => s.inference);
  const [tokens, setTokens] = useState<string[]>([]);
  const [resolved, setResolved] = useState(false);
  const [resolvedStats, setResolvedStats] = useState<{ tokens: number; seconds: string } | null>(null);

  const generationStartRef = useRef<number>(0);
  const totalTokensRef = useRef<number>(0);

  const isVisible = inference === 'generating' || inference === 'resolved';

  // ── Token streaming simulation ─────────────────────────────────────────────
  useEffect(() => {
    if (inference !== 'generating') return;

    setTokens([]);
    setResolved(false);
    setResolvedStats(null);
    generationStartRef.current = performance.now();
    totalTokensRef.current = 0;

    let i = 0;
    const interval = setInterval(() => {
      const token = FAKE_TOKENS[i % FAKE_TOKENS.length];
      setTokens((prev) => [...prev.slice(-19), token]);
      totalTokensRef.current++;
      i++;
      if (i > 40) {
        clearInterval(interval);
      }
    }, 180);

    return () => clearInterval(interval);
  }, [inference]);

  // ── Resolved state transition ──────────────────────────────────────────────
  useEffect(() => {
    if (inference === 'resolved') {
      const elapsed = ((performance.now() - generationStartRef.current) / 1000).toFixed(1);
      setResolvedStats({ tokens: totalTokensRef.current || 127, seconds: elapsed });
      setResolved(true);
    } else {
      setResolved(false);
    }
  }, [inference]);

  // ── Reset on non-active states ─────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) {
      setTokens([]);
      setResolved(false);
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="streaming-token-visualizer"
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 600,
            height: 120,
            background: 'rgba(0, 0, 0, 0.80)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 240, 255, 0.20)',
            borderRadius: 8,
            boxShadow: '0 0 24px rgba(0, 240, 255, 0.08), 0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 40,
            pointerEvents: 'none',
          }}
        >
          {/* ── Token stream section ──────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              padding: '8px 10px 4px',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Left fade mask */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 24,
                background: 'linear-gradient(to right, rgba(0,0,0,0.8), transparent)',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
            {/* Right fade mask */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 24,
                background: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />

            {resolved && resolvedStats ? (
              /* Completion message */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: 11,
                  color: 'rgba(0, 240, 255, 0.9)',
                  textShadow: '0 0 10px rgba(0, 240, 255, 0.6)',
                  letterSpacing: '0.05em',
                  paddingLeft: 4,
                }}
              >
                {'// INFERENCE RESOLVED'} —{' '}
                <span style={{ color: 'rgba(180, 100, 255, 0.9)' }}>
                  {resolvedStats.tokens} tokens generated in {resolvedStats.seconds}s
                </span>
              </motion.div>
            ) : (
              /* Scrolling token stream */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  overflow: 'hidden',
                  flexWrap: 'nowrap',
                  width: '100%',
                  paddingLeft: 4,
                }}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {tokens.map((tok, i) => (
                    <TokenChip
                      key={`${tok}-${i}-${tokens.length}`}
                      token={tok}
                      index={i}
                      total={tokens.length}
                    />
                  ))}
                </AnimatePresence>
                {/* Blinking cursor */}
                {!resolved && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 13,
                      background: 'rgba(0, 240, 255, 0.9)',
                      boxShadow: '0 0 6px rgba(0, 240, 255, 0.8)',
                      borderRadius: 1,
                      flexShrink: 0,
                      marginLeft: 2,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <div
            style={{
              height: 1,
              background: 'rgba(0, 240, 255, 0.10)',
              margin: '0 10px',
            }}
          />

          {/* ── Waveform bar section ──────────────────────────────────────── */}
          <div
            style={{
              height: 44,
              padding: '4px 2px 4px',
              display: 'flex',
              alignItems: 'flex-end',
            }}
          >
            <WaveformBars settled={resolved} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
