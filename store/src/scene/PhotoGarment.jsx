import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import garmentViews from "../data/garmentViews.json";
import { clamp, lerp, smoothstep, smootherstep, mod } from "../lib/math";

// ============================================================
// قطعة ملابس مصنوعة من صور: بطاقة تواجه الكاميرا دائمًا
// وتبدّل الصورة (أمام / جانب / خلف) حسب زاوية الدوران "turn".
// ============================================================

const QUARTER = Math.PI / 2; // ربع دورة
// ترتيب الصور عند الدوران: أمام ← جانب ← خلف ← جانب معكوس
const VIEW_NAMES = ["front", "side", "back", "side"];
const MIRRORED = [false, false, false, true];

const BAND = 0.12; // نطاق تبديل الصورة (12% من ربع الدورة)
const TILT = 0.5; // ميلان المنظور
export const REST_TURN = -1.35; // وضع الراحة: القطعة شبه جانبية
const ASSET_VERSION = 1; // ارفع الرقم عند تغيير الصور ليتحدث المتصفح

const _pos = new THREE.Vector3();

// يضع بطاقة الصورة بحيث تقع نقطة تعليق الشماعة عند أصل المجموعة
function placeCard(mesh, view, mirrored, w, h) {
  const ax = mirrored ? 1 - view.anchor[0] : view.anchor[0];
  mesh.scale.set(mirrored ? -w : w, h, 1);
  mesh.position.x = (0.5 - ax) * w;
  mesh.position.y = (view.anchor[1] - 0.5) * h;
}

export default function PhotoGarment({ id, target = REST_TURN, position = [0, 0, 0] }) {
  const views = garmentViews[id];
  const urls = ["front", "side", "back"].map(
    (v) => `/garments/${id}/${v}.webp?v=${ASSET_VERSION}`
  );
  const loaded = useTexture(urls, (tex) => {
    (Array.isArray(tex) ? tex : [tex]).forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    });
  });
  // الجانب المعكوس يستعمل نفس صورة الجانب
  const textures = [loaded[0], loaded[1], loaded[2], loaded[1]];

  const { camera } = useThree();
  const turn = useRef(REST_TURN);
  const lastA = useRef(-1);
  const lastB = useRef(-1);
  const group = useRef();
  const inner = useRef();
  const meshA = useRef();
  const meshB = useRef();
  const matA = useRef();
  const matB = useRef();

  useFrame((_, dt) => {
    // حركة ناعمة نحو الهدف
    turn.current = THREE.MathUtils.damp(turn.current, target, 8, Math.min(dt, 0.05));

    const t = turn.current / QUARTER;
    const i = Math.floor(t);
    const f = t - i; // موضعنا بين صورتين (0 → 1)
    const a = mod(i, 4);
    const b = mod(i + 1, 4);
    const va = views[VIEW_NAMES[a]];
    const vb = views[VIEW_NAMES[b]];

    // العرض والارتفاع يتغيران تدريجيًا بين الصورتين
    const e = smoothstep(f);
    const w = lerp(va.size[0], vb.size[0], e);
    const h = lerp(va.size[1], vb.size[1], e);
    placeCard(meshA.current, va, MIRRORED[a], w, h);
    placeCard(meshB.current, vb, MIRRORED[b], w, h);
    meshB.current.position.z = 0.002;

    // نغيّر الصورة فقط عند الحاجة
    if (lastA.current !== a) {
      matA.current.map = textures[a];
      lastA.current = a;
    }
    if (lastB.current !== b) {
      matB.current.map = textures[b];
      lastB.current = b;
    }

    // التبديل بين الصورتين يحدث في نطاق ضيق في المنتصف
    const s = smootherstep((f - (0.5 - BAND / 2)) / BAND);
    matB.current.opacity = clamp(s * 2);
    matA.current.opacity = clamp(2 * (1 - s));
    meshA.current.visible = matA.current.opacity > 0.002;
    meshB.current.visible = matB.current.opacity > 0.002;

    // ميلان بسيط بحسب اتجاه الدوران، ويصبح صفرًا لحظة التبديل
    const off = (f < 0.5 ? f : f - 1) * QUARTER;
    const g = smoothstep(Math.abs(f - 0.5) / 0.1);
    const tilt = TILT * off * g;

    // البطاقة تواجه الكاميرا حول المحور الرأسي فقط
    group.current.getWorldPosition(_pos);
    const yaw = Math.atan2(camera.position.x - _pos.x, camera.position.z - _pos.z);
    inner.current.rotation.y = yaw + tilt;
  });

  const cardMaterial = (ref) => (
    <meshBasicMaterial
      ref={ref}
      transparent
      alphaTest={0.02}
      toneMapped={false}
      side={THREE.DoubleSide}
    />
  );

  return (
    <group ref={group} position={position}>
      <group ref={inner}>
        <mesh ref={meshA} castShadow>
          <planeGeometry args={[1, 1]} />
          {cardMaterial(matA)}
        </mesh>
        <mesh ref={meshB} castShadow>
          <planeGeometry args={[1, 1]} />
          {cardMaterial(matB)}
        </mesh>
      </group>
    </group>
  );
}
