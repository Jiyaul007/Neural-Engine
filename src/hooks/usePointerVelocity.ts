import { useEffect, useRef } from 'react';
import { useSystemState } from '../engine/SystemState';
import { PHYSICS } from '../engine/constants';

export function usePointerVelocity() {
  const setPointer = useSystemState((state) => state.setPointer);
  
  const lastPos = useRef({ x: 0, y: 0, time: performance.now() });
  const currentVel = useRef({ vx: 0, vy: 0 });
  const rafId = useRef<number>();

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const now = performance.now();
      const dt = Math.max(1, now - lastPos.current.time);
      
      const dx = clientX - lastPos.current.x;
      const dy = clientY - lastPos.current.y;
      
      currentVel.current.vx = dx / dt;
      currentVel.current.vy = dy / dt;
      
      lastPos.current = { x: clientX, y: clientY, time: now };
      
      const nx = (clientX / window.innerWidth) * 2 - 1;
      const ny = -(clientY / window.innerHeight) * 2 + 1;
      const speed = Math.sqrt(currentVel.current.vx ** 2 + currentVel.current.vy ** 2);
      
      setPointer(clientX, clientY, nx, ny, currentVel.current.vx, currentVel.current.vy, speed);
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const nx = (clientX / window.innerWidth) * 2 - 1;
      const ny = -(clientY / window.innerHeight) * 2 + 1;
      useSystemState.getState().triggerShockwave(nx, ny, 1.0);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('touchstart', handleDown, { passive: true });

    const applyDamping = () => {
      currentVel.current.vx *= PHYSICS.DAMPING;
      currentVel.current.vy *= PHYSICS.DAMPING;
      
      if (Math.abs(currentVel.current.vx) > 0.01 || Math.abs(currentVel.current.vy) > 0.01) {
        const speed = Math.sqrt(currentVel.current.vx ** 2 + currentVel.current.vy ** 2);
        
        const now = performance.now();
        if (now - lastPos.current.time > 50) {
           useSystemState.setState((state) => ({
             pointer: {
               ...state.pointer,
               vx: currentVel.current.vx,
               vy: currentVel.current.vy,
               speed
             }
           }));
        }
      }
      
      rafId.current = requestAnimationFrame(applyDamping);
    };
    
    rafId.current = requestAnimationFrame(applyDamping);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('touchstart', handleDown);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [setPointer]);
}
