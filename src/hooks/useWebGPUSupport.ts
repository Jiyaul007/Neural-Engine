import { useEffect } from 'react';
import { useSystemState } from '../engine/SystemState';
import { PARTICLE_COUNT_WEBGPU, PARTICLE_COUNT_WEBGL, PARTICLE_COUNT_MOBILE } from '../engine/constants';

export function useWebGPUSupport() {
  const { setGpuBackend } = useSystemState();

  useEffect(() => {
    const checkSupport = async () => {
      const nav = navigator as any;
      if (nav.gpu) {
        try {
          const adapter = await nav.gpu.requestAdapter();
          if (adapter) {
            setGpuBackend('webgpu');
            useSystemState.setState({ particleCount: PARTICLE_COUNT_WEBGPU });
            return;
          }
        } catch (e) {
          console.warn('WebGPU requestAdapter failed', e);
        }
      }
      setGpuBackend('webgl2');
      
      const isMobile = window.innerWidth <= 768;
      useSystemState.setState({ particleCount: isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_WEBGL });
    };

    checkSupport();
  }, [setGpuBackend]);
}
