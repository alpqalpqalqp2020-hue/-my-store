import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Scene from "./scene/Scene";
import { STORE_NAME, STORE_TAGLINE } from "./data/products";

export default function App() {
  return (
    <div className="app">
      <Canvas
        shadows="variance"
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 3.3], fov: 32, near: 0.1, far: 40 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          // ألوان صادقة للمنتجات
          gl.toneMapping = THREE.NeutralToneMapping;
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      <header className="header">
        <div className="brand">{STORE_NAME}</div>
        <div className="tagline">{STORE_TAGLINE}</div>
      </header>

      <div className="hint">مرّر المؤشر على القطعة لتواجهك · على الجوال المسها</div>
    </div>
  );
}
