import { useState } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import Wall from "./Wall";
import Rack from "./Rack";
import Stage from "./Stage";
import { products } from "../data/products";

// نقطة ينظر إليها المشاهد
const LOOK_AT = new THREE.Vector3(0, 1.45, 0);

// الكاميرا تتحرك حركة طفيفة جدًا مع المؤشر لتعطي إحساسًا بالعمق
// (وتثبت عندما يكون هناك منتج مفتوح)
function CameraRig({ frozen }) {
  const base = useRef(null);
  useFrame(({ camera, pointer }, dt) => {
    if (!base.current) base.current = camera.position.clone();
    const k = frozen ? 0 : 1;
    const tx = base.current.x + pointer.x * 0.12 * k;
    const ty = base.current.y + pointer.y * 0.05 * k;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 3, dt);
    camera.lookAt(LOOK_AT);
  });
  return null;
}

export default function Scene({ openId, view, onOpen }) {
  const clothes = products.filter((p) => p.category === "clothing");
  const [shownId, setShownId] = useState(null); // المنتج الذي تعرضه المنصة الآن

  return (
    <>
      {/* انعكاسات للمعدن: ألواح ضوء (softboxes) فقط، بلا صور من الإنترنت */}
      <Environment resolution={256}>
        {/* إضاءة عامة خافتة تملأ الغرفة (حتى لا يبدو المعدن أسود) */}
        <Lightformer form="rect" intensity={0.55} position={[0, 1.5, 9]} scale={[40, 14, 1]} color="#e9e6df" target={[0, 1.5, 0]} />
        {/* لوح أمامي طويل: يعطي الخط اللامع على القضيب */}
        <Lightformer form="rect" intensity={3.2} position={[0, 2.4, 6]} scale={[14, 0.9, 1]} target={[0, 1.75, 0]} />
        {/* لوح علوي */}
        <Lightformer form="rect" intensity={2.4} position={[0, 5, 3]} scale={[12, 3, 1]} target={[0, 1.75, 0]} />
        {/* لوحان جانبيان */}
        <Lightformer form="rect" intensity={1.6} position={[-6, 1.8, 3]} scale={[6, 2, 1]} target={[0, 1.75, 0]} />
        <Lightformer form="rect" intensity={1.6} position={[6, 1.8, 3]} scale={[6, 2, 1]} target={[0, 1.75, 0]} />
      </Environment>

      {/* الضوء الذي يصنع الظلال */}
      <directionalLight
        castShadow
        position={[0.9, 3.0, 4.4]}
        intensity={1.5}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-1}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
        shadow-bias={-0.0004}
        shadow-radius={6}
        shadow-blurSamples={8}
      />

      <Wall />
      <Rack items={clothes} openId={openId} hiddenId={shownId} onOpen={onOpen} />
      <Stage items={clothes} openId={openId} view={view} onShown={setShownId} />
      <CameraRig frozen={!!openId} />
    </>
  );
}
