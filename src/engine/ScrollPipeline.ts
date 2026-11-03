import * as THREE from 'three';
import { SCROLL_PHASES, CAMERA_PATH } from './constants';

export function getPhaseForProgress(progress: number) {
  for (const key of Object.keys(SCROLL_PHASES)) {
    const phase = SCROLL_PHASES[key as keyof typeof SCROLL_PHASES];
    if (progress >= phase.start && progress <= phase.end) {
      const range = phase.end - phase.start;
      const phaseProgress = range > 0 ? (progress - phase.start) / range : 1;
      return {
        name: phase.name,
        start: phase.start,
        end: phase.end,
        phaseProgress
      };
    }
  }
  return { name: 'DEPLOYMENT', start: 0.8, end: 1.0, phaseProgress: 1 };
}

export const PHASE_CONFIGS = Object.values(SCROLL_PHASES);

export const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const cameraCurve = new THREE.CatmullRomCurve3(CAMERA_PATH);

export function getCameraPositionForProgress(progress: number): THREE.Vector3 {
  const eased = easeInOutCubic(progress);
  return cameraCurve.getPoint(eased);
}
