import React, { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import { Loader2, AlertTriangle, Box, FolderOpen, X } from 'lucide-react';

// ── Spinning placeholder mesh ─────────────────────────────────────────────────
function TerrainPlaceholder() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.3;
  });

  // Generate terrain from perlin-ish noise
  const geo = new THREE.PlaneGeometry(10, 10, 64, 64);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i);
    const height =
      Math.sin(x * 0.8) * 0.6 +
      Math.cos(z * 0.9) * 0.4 +
      Math.sin((x + z) * 0.5) * 0.3;
    pos.setZ(i, height);
  }
  geo.computeVertexNormals();

  return (
    <mesh ref={meshRef} geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color="#0ea5e9"
        wireframe
        transparent
        opacity={0.4}
      />
    </mesh>
  );
}

// ── OBJ model loader ──────────────────────────────────────────────────────────
function OBJModel({ objUrl }: { objUrl: string }) {
  const obj = useLoader(OBJLoader, objUrl);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!obj) return;
    // Center model
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    // Scale to fit in view
    const size = box.getSize(new THREE.Vector3()).length();
    const scale = 8 / size;
    obj.scale.setScalar(scale);
  }, [obj]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.15;
  });

  return <group ref={groupRef}><primitive object={obj} /></group>;
}

// ── Main scene ────────────────────────────────────────────────────────────────
function Scene({ objUrl }: { objUrl?: string | null }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 6, 10]} fov={50} />
      <OrbitControls enableDamping dampingFactor={0.05} minDistance={2} maxDistance={40} />
      <ambientLight intensity={0.8} color="#c8d8ff" />
      <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" castShadow />
      <directionalLight position={[-10, 5, -5]} intensity={0.5} color="#4488ff" />
      <pointLight position={[0, 8, 0]} intensity={0.4} color="#38bdf8" />
      <Grid
        position={[0, -3, 0]}
        args={[30, 30]}
        cellSize={1}
        cellColor="#1e293b"
        sectionColor="#334155"
        fadeDistance={20}
        fadeStrength={1}
      />
      {objUrl ? (
        <Suspense fallback={<TerrainPlaceholder />}>
          <OBJModel objUrl={objUrl} />
        </Suspense>
      ) : (
        <TerrainPlaceholder />
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Model3DViewerProps {
  objUrl?: string | null;
  isLoading?: boolean;
  error?: string | null;
  qualityTier?: string;
}

const Model3DViewer: React.FC<Model3DViewerProps> = ({ objUrl: propObjUrl, isLoading, error, qualityTier }) => {
  const [canvasError, setCanvasError] = useState(false);
  const [localObjUrl, setLocalObjUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFastMode = qualityTier === 'fast' || qualityTier === 'lightning';

  const objUrl = propObjUrl || localObjUrl;
  const noModel = !objUrl && !isLoading;

  const handleFileOpen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalObjUrl(url);
    e.target.value = ''; // reset so same file can be re-selected
  }, []);

  const handleClearLocal = useCallback(() => {
    if (localObjUrl) URL.revokeObjectURL(localObjUrl);
    setLocalObjUrl(null);
  }, [localObjUrl]);

  if (canvasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4"
        style={{ background: '#0a0f1e' }}>
        <AlertTriangle className="w-8 h-8" style={{ color: '#f87171' }} />
        <p className="text-sm font-black text-white">3D viewer unavailable</p>
        <p className="text-xs" style={{ color: '#475569' }}>WebGL is required for the 3D model viewer</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ background: '#030712' }}>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".obj"
        className="hidden"
        onChange={handleFileOpen}
      />

      {/* Three.js canvas */}
      <Canvas
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#030712');
          gl.shadowMap.enabled = true;
        }}
        onError={() => setCanvasError(true)}
      >
        <Scene objUrl={objUrl} />
      </Canvas>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(4px)' }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#38bdf8' }} />
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#475569' }}>
            Loading 3D model…
          </p>
        </div>
      )}

      {/* No model notice — bottom banner */}
      {noModel && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-3"
          style={{ background: 'rgba(3,7,18,0.9)', borderTop: '1px solid rgba(234,179,8,0.2)', backdropFilter: 'blur(8px)' }}>
          <Box className="w-4 h-4 shrink-0" style={{ color: '#facc15' }} />
          <div className="min-w-0 flex-1">
            {isFastMode ? (
              <>
                <p className="text-xs font-black text-white">⚡ Lightning Mode — No 3D mesh generated</p>
                <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: '#64748b' }}>
                  Wireframe terrain preview shown. Run a Standard quality job for the full textured 3D model.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-black text-white">3D Model Not Available</p>
                <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: '#64748b' }}>
                  No textured mesh was produced for this job. Re-process with Standard quality to generate the 3D model.
                </p>
              </>
            )}
          </div>
          {/* Open local OBJ file */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 transition-all hover:opacity-80 active:scale-95"
            style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }}
          >
            <FolderOpen className="w-3 h-3" />
            Open OBJ
          </button>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5">
        <div className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
          style={{ background: 'rgba(3,7,18,0.85)', border: '1px solid rgba(255,255,255,0.07)', color: '#475569', backdropFilter: 'blur(8px)' }}>
          🖱 Drag to rotate · Scroll to zoom
        </div>
        {objUrl && (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', backdropFilter: 'blur(8px)' }}>
              ✓ 3D model loaded
            </div>
            {localObjUrl && (
              <button
                onClick={handleClearLocal}
                className="px-2 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-70"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', backdropFilter: 'blur(8px)' }}
                title="Close local file"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Model3DViewer;
