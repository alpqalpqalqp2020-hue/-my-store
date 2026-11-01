import { useEffect, useRef, useState } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Wall from "./Wall";
import Rack from "./Rack";
import Stage from "./Stage";
import { products } from "../data/products";
import garmentViews from "../data/garmentViews.json";
import { computeLayout } from "./layout";
import { clamp } from "../lib/math";
import { pan } from "./pan";

// قطع الملابس وترتيبها على القضيب (يُحسب مرة واحدة)
const clothes = products.filter((p) => p.category === "clothing");
const layout = computeLayout(clothes, garmentViews);

const PORTRAIT_VIEW_W = 1.1; // عرض الرف الظاهر على الجوال (بالمتر)
const PAN_CLICK_LIMIT = 10; // تحرّك أقل من 10 بكسل يُعدّ نقرة وليس سحبًا

// الكاميرا: تتسع لتشمل الرف، وتنتقل بالسحب، وتتحرك قليلًا مع المؤشر
function CameraRig({ frozen }) {
  useFrame(({ camera, pointer, size }, dt) => {
    const aspect = size.width / size.height;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

    // أي عرض من الرف نريد أن نراه؟
    const viewW =
      aspect < 1 ? PORTRAIT_VIEW_W : clamp(layout.restWidth + 2 * layout.maxDelta + 1.2, 3.0, 4.2);
    const dist = clamp(viewW / (aspect * 2 * tanH), 2.4, 8);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, dist, 3, dt);

    // التنقل بالسحب
    const visibleW = 2 * camera.position.z * tanH * aspect;
    pan.mpp = visibleW / size.width;
    pan.max = Math.max(0, (Math.max(3, layout.railLength) - viewW) / 2);
    pan.target = clamp(pan.target, -pan.max, pan.max);
    pan.current = THREE.MathUtils.damp(pan.current, pan.target, 6, dt);

    // حركة خفيفة مع المؤشر (تتوقف عند فتح منتج)
    const k = frozen ? 0 : 1;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pan.current + pointer.x * 0.12 * k, 4, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.5 + pointer.y * 0.05 * k, 3, dt);
    camera.lookAt(pan.current, 1.45, 0);
  });
  return null;
}

// يلتقط السحب بالفأرة أو الإصبع والعجلة، ويحوّلها إلى تنقل على الرف
function PanControls({ enabled }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    pan.enabled = enabled;
  }, [enabled]);

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e) => {
      pan.moved = false;
      pan.dragging = false;
      pan.down = { x: e.clientX, y: e.clientY, start: pan.target };
    };
    const onMove = (e) => {
      if (!pan.down || !pan.enabled || pan.max <= 0) return;
      const dx = e.clientX - pan.down.x;
      const dy = e.clientY - pan.down.y;
      if (!pan.moved && Math.hypot(dx, dy) > PAN_CLICK_LIMIT) {
        pan.moved = true;
        pan.dragging = true;
      }
      if (pan.moved) pan.target = clamp(pan.down.start - dx * pan.mpp, -pan.max, pan.max);
    };
    const onUp = () => {
      pan.down = null;
      pan.dragging = false; // نُبقي pan.moved ليعرف حدث النقر أنه كان سحبًا
    };
    const onWheel = (e) => {
      if (!pan.enabled || pan.max <= 0) return;
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      pan.target = clamp(pan.target + d * pan.mpp, -pan.max, pan.max);
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  return null;
}

// الضوء الذي يصنع الظلال: يتبع الكاميرا ليبقى الظل صحيحًا على الرف الطويل
function KeyLight() {
  const light = useRef();
  useFrame(({ camera }) => {
    const x = camera.position.x;
    light.current.position.set(x + 0.9, 3.0, 4.4);
    light.current.target.position.set(x, 0, 0);
    light.current.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      castShadow
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
  );
}

export default function Scene({ openId, view, onOpen }) {
  const [shownId, setShownId] = useState(null); // المنتج الذي تعرضه المنصة الآن
  const wallWidth = Math.max(14, Math.max(3, layout.railLength) + 8);

  return (
    <>
      {/* انعكاسات للمعدن: ألواح ضوء (softboxes) فقط، بلا صور من الإنترنت */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={0.55} position={[0, 1.5, 9]} scale={[40, 14, 1]} color="#e9e6df" target={[0, 1.5, 0]} />
        <Lightformer form="rect" intensity={3.2} position={[0, 2.4, 6]} scale={[14, 0.9, 1]} target={[0, 1.75, 0]} />
        <Lightformer form="rect" intensity={2.4} position={[0, 5, 3]} scale={[12, 3, 1]} target={[0, 1.75, 0]} />
        <Lightformer form="rect" intensity={1.6} position={[-6, 1.8, 3]} scale={[6, 2, 1]} target={[0, 1.75, 0]} />
        <Lightformer form="rect" intensity={1.6} position={[6, 1.8, 3]} scale={[6, 2, 1]} target={[0, 1.75, 0]} />
      </Environment>

      <KeyLight />
      <Wall width={wallWidth} />
      <Rack items={clothes} layout={layout} openId={openId} hiddenId={shownId} onOpen={onOpen} />
      <Stage items={clothes} layout={layout} openId={openId} view={view} onShown={setShownId} />
      <CameraRig frozen={!!openId} />
      <PanControls enabled={!openId} />
    </>
  );
}
