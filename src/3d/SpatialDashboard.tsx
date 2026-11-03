import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSystemState } from '../engine/SystemState';
import { CAMERA_PATH } from '../engine/constants';
import { DataStreams } from './DataStreams';

const FEATURES = [
  { id: 'synthesis', name: 'NEURAL SYNTHESIS', desc: 'High-realism generative image engine', color: '#00f0ff' },
  { id: 'aesthetic', name: 'AESTHETIC MOD', desc: 'Real-time style transfer and refinement', color: '#ff3366' },
  { id: 'latent', name: 'LATENT NAVIGATION', desc: 'Explore high-dimensional manifolds', color: '#33ff99' },
  { id: 'temporal', name: 'TEMPORAL PROCESSING', desc: 'Video synthesis and prediction', color: '#ffaa00' },
  { id: 'semantic', name: 'SEMANTIC ENGINE', desc: 'Vision-language understanding', color: '#aa66ff' },
];

export function SpatialDashboard() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const setHoveredFeature = useSystemState((s) => s.setHoveredFeature);
  const setActiveModal = useSystemState((s) => s.setActiveModal);

  const panelPositions = useMemo(() => {
    return FEATURES.map((_, i) => {
      const angle = (i / FEATURES.length) * Math.PI * 2;
      const radius = 4;
      const y = (i - 2) * 1.5;
      return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    });
  }, []);

  const cameraCurve = useMemo(() => {
    if (CAMERA_PATH && CAMERA_PATH.length > 0) {
        return new THREE.CatmullRomCurve3(CAMERA_PATH);
    }
    // Fallback if CAMERA_PATH is empty
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 10),
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(0, 0, 0)
    ]);
  }, []);

  const panelRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const sysState = useSystemState.getState();
    const scroll = sysState.scroll.progress;
    const velocity = sysState.scroll.velocity;
    const time = sysState.time;

    // Camera Path in cinematic mode
    if (sysState.cameraMode === 'cinematic') {
      if (scroll < 0.35) {
        // Smoothly return camera to hero home position
        camera.position.lerp(new THREE.Vector3(0, 0, 10), 0.08);
        camera.lookAt(0, 0, 0);
      } else if (scroll >= 0.35 && scroll <= 0.8) {
        const pathProgress = THREE.MathUtils.clamp((scroll - 0.35) / 0.45, 0, 1);
        const camPos = cameraCurve.getPoint(pathProgress);
        camera.position.lerp(camPos, 0.08);
        
        const lookAtPos = cameraCurve.getPoint(Math.min(pathProgress + 0.1, 1));
        camera.lookAt(lookAtPos);
      } else {
        // Deployment phase
        camera.position.lerp(new THREE.Vector3(0, 0, 8), 0.08);
        camera.lookAt(0, 0, 0);
      }
    }

    // Visibility
    const isVisible = scroll >= 0.25 && scroll <= 0.85;
    if (groupRef.current) {
      groupRef.current.visible = isVisible;
    }

    if (!isVisible) return;

    // Panel Animation
    panelRefs.current.forEach((panel, i) => {
      if (!panel) return;
      
      // Bobbing
      panel.position.y = panelPositions[i].y + Math.sin(time * 2 + i) * 0.2;

      // Tilt based on velocity
      panel.rotation.x = THREE.MathUtils.lerp(panel.rotation.x, velocity * 0.5, 0.1);

      // Emissive glow based on distance to camera
      const dist = panel.position.distanceTo(camera.position);
      const material = panel.material as THREE.MeshPhysicalMaterial;
      if (material) {
        const targetEmissiveIntensity = Math.max(0, 1 - dist / 5);
        material.emissiveIntensity = THREE.MathUtils.lerp(material.emissiveIntensity, targetEmissiveIntensity, 0.1);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {FEATURES.map((feature, i) => (
        <RoundedBox
          key={feature.id}
          ref={(el) => { panelRefs.current[i] = el; }}
          position={panelPositions[i]}
          args={[2.5, 1.2, 0.1]}
          radius={0.05}
          smoothness={4}
          onPointerOver={() => {
            setHoveredFeature(feature.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHoveredFeature(null);
            document.body.style.cursor = 'auto';
          }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveModal(feature.id);
          }}
        >
          <meshPhysicalMaterial
            transparent
            opacity={0.8}
            roughness={0.2}
            metalness={0.8}
            transmission={0.9}
            ior={1.5}
            thickness={0.5}
            emissive={feature.color}
            emissiveIntensity={0}
            color="#111111"
          />
          <Html transform distanceFactor={5} position={[0, 0, 0.06]}>
            <div className="w-[200px] h-[100px] p-2 flex flex-col justify-between text-white select-none pointer-events-none" style={{ fontFamily: 'sans-serif' }}>
              <div>
                <h3 className="text-xs font-bold tracking-wider mb-1" style={{ color: feature.color }}>{feature.name}</h3>
                <p className="text-[10px] text-gray-300 leading-tight">{feature.desc}</p>
              </div>
              <div className="flex items-end gap-1 h-4">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <div 
                    key={bar} 
                    className="w-1 opacity-50 animate-pulse" 
                    style={{ 
                      height: `${Math.random() * 100}%`,
                      animationDelay: `${bar * 0.1}s`,
                      backgroundColor: feature.color
                    }} 
                  />
                ))}
              </div>
            </div>
          </Html>
        </RoundedBox>
      ))}
      <DataStreams positions={panelPositions} colors={FEATURES.map(f => f.color)} />
    </group>
  );
}
