import React from 'react';
import { NeuralText } from './NeuralText';
import { useSystemState } from '../engine/SystemState';

const SectionLabel: React.FC<{ text: string; sub?: string }> = ({ text, sub }) => (
  <div className="flex flex-col items-center gap-2">
    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/20">{sub}</span>
    <NeuralText
      text={text}
      tag="h2"
      className="text-[6vw] md:text-[5vw] font-black leading-[0.85] tracking-[-0.04em] text-white/80"
      scrambleOnHover
    />
  </div>
);

export const ScrollSections: React.FC = () => {
  const setActiveModal = useSystemState((s) => s.setActiveModal);

  return (
    <div className="relative w-full z-[5]" style={{ height: '600vh' }}>
      {/* INITIALIZATION (0-15%) — Hero fills this space */}
      <section
        className="absolute w-full flex items-end justify-center pb-[10vh] pointer-events-none"
        style={{ height: '15%', top: '0%' }}
      >
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/15 animate-pulse">
          SCROLL TO INITIALIZE PIPELINE ↓
        </div>
      </section>

      {/* INGESTION (15-35%) — Data streams form */}
      <section
        className="absolute w-full flex items-center justify-center pointer-events-none"
        style={{ height: '20%', top: '15%' }}
      >
        <SectionLabel text="DATA INGESTION" sub="// PHASE 02 — STREAM ACQUISITION" />
      </section>

      {/* INFERENCE (35-60%) — Spatial dashboard */}
      <section
        className="absolute w-full flex items-center justify-center pointer-events-none"
        style={{ height: '25%', top: '35%' }}
      >
        <SectionLabel text="SPATIAL INFERENCE" sub="// PHASE 03 — PROCESSING PIPELINE" />
      </section>

      {/* CAPABILITIES (60-80%) — Feature deep dives */}
      <section
        className="absolute w-full flex flex-col items-center justify-center gap-6 pointer-events-none"
        style={{ height: '20%', top: '60%' }}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/20">
          // PHASE 04 — CAPABILITY MATRIX
        </span>
        {[
          { label: 'NEURAL SYNTHESIS', id: 'synthesis' },
          { label: 'AESTHETIC MODIFICATION', id: 'aesthetic' },
          { label: 'LATENT NAVIGATION', id: 'synthesis' },
          { label: 'TEMPORAL PROCESSING', id: 'temporal' },
          { label: 'SEMANTIC UNDERSTANDING', id: 'semantic' },
        ].map((feature, i) => (
          <div
            key={i}
            onClick={() => setActiveModal(feature.id)}
            className="cursor-pointer group flex items-center gap-3"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-cyan-400 transition-colors" />
            <NeuralText
              text={feature.label}
              tag="h3"
              className="text-[3vw] md:text-[2.5vw] font-bold text-white/40 group-hover:text-white transition-colors duration-300 pointer-events-auto cursor-pointer"
              scrambleOnHover
            />
          </div>
        ))}
      </section>

      {/* DEPLOYMENT (80-100%) — Footer void */}
      <section
        className="absolute w-full flex flex-col items-center justify-center gap-8 pointer-events-auto"
        style={{ height: '20%', top: '80%' }}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/15">
          // PHASE 05 — DEPLOYMENT
        </span>
        <NeuralText
          text="INITIALIZE YOUR ENGINE."
          tag="h2"
          className="text-[7vw] md:text-[5vw] font-black leading-[0.9] tracking-[-0.03em] text-white cursor-pointer"
          scrambleOnHover
        />
        <button
          onClick={() => setActiveModal('synthesis')}
          className="mt-4 px-8 py-3 border border-cyan-400/40 text-cyan-300 font-mono text-xs uppercase tracking-[0.15em] bg-cyan-950/20 hover:bg-cyan-400 hover:text-black transition-all duration-300 cursor-pointer shadow-lg hover:shadow-cyan-400/30"
        >
          DISPATCH NEURAL ENGINE
        </button>
      </section>
    </div>
  );
};
