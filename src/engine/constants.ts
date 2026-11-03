import * as THREE from 'three';

export const PARTICLE_COUNT_WEBGPU = 500000;
export const PARTICLE_COUNT_WEBGL = 100000;
export const PARTICLE_COUNT_MOBILE = 25000;

export const SCROLL_PHASES = {
  INITIALIZATION: { start: 0, end: 0.15, name: 'INITIALIZATION' },
  INGESTION: { start: 0.15, end: 0.35, name: 'INGESTION' },
  INFERENCE: { start: 0.35, end: 0.60, name: 'INFERENCE' },
  CAPABILITIES: { start: 0.60, end: 0.80, name: 'CAPABILITIES' },
  DEPLOYMENT: { start: 0.80, end: 1.0, name: 'DEPLOYMENT' },
};

export const COLORS = {
  VOID_BLACK: '#000000',
  CORE_CYAN: '#00f0ff',
  INFERENCE_PURPLE: '#bf00ff',
  ERROR_RED: '#ff003c',
  SUCCESS_GREEN: '#00ff66',
  TEXT_MUTED: '#888888',
  TEXT_PRIMARY: '#ffffff',
};

export const PHYSICS = {
  DAMPING: 0.95,
  SPRING_STIFFNESS: 0.05,
  MOUSE_INFLUENCE_RADIUS: 2.5,
  FORMATION_FORCE: 0.1,
};

export const CAMERA_PATH = [
  new THREE.Vector3(0, 0, 10),
  new THREE.Vector3(5, 2, 5),
  new THREE.Vector3(0, 5, -5),
  new THREE.Vector3(-5, -2, 0),
  new THREE.Vector3(0, 0, 8),
];

export const FEATURE_MODULES = [
  { id: 'nlp', name: 'Natural Language', description: 'Advanced semantic parsing and text generation.' },
  { id: 'vision', name: 'Computer Vision', description: 'Real-time spatial analysis and object recognition.' },
  { id: 'predictive', name: 'Predictive Analytics', description: 'Time-series forecasting and trend modeling.' },
  { id: 'optimization', name: 'System Optimization', description: 'Automated resource allocation and load balancing.' },
];
