import { useEffect, useRef } from 'react';
import { useSystemState } from '../engine/SystemState';
import { PHYSICS } from '../engine/constants';

export function useScrollVelocity() {
  const setScroll = useSystemState((state) => state.setScroll);
  
  const rafId = useRef<number>();
  
  useEffect(() => {
    const loop = () => {
      const state = useSystemState.getState();
      let vel = state.scroll.velocity;
      
      if (Math.abs(vel) > 0.001) {
        vel *= PHYSICS.DAMPING;
        setScroll(state.scroll.progress, vel);
      }
      
      rafId.current = requestAnimationFrame(loop);
    };
    
    rafId.current = requestAnimationFrame(loop);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    }
  }, [setScroll]);
}
