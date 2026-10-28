import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import PhotoGarment from "./PhotoGarment";
import garmentViews from "../data/garmentViews.json";
import { hangPosition } from "./layout";
import { lerp, smoothstep } from "../lib/math";

// ============================================================
// منصة عرض المنتج: عند فتح منتج تطير القطعة من القضيب إلى
// موضع أمام الكاميرا (نسبةً للكاميرا لا للغرفة)، وتظهر خلفية معتمة.
// ============================================================

// زاوية الدوران لكل زر صورة: أمام / جانب / خلف
export const VIEW_TURNS = [0, Math.PI / 2, Math.PI];
const JUMP_LIMIT = 1.75; // قفزة أكبر من ~100° تُستبدل بتلاشٍ سريع
const DIST = 1.6; // بُعد القطعة عن الكاميرا
const BACK_DIST = 1.9; // بُعد الخلفية المعتمة

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _rack = new THREE.Vector3();

export default function Stage({ items, openId, view, onShown }) {
  const { camera, size } = useThree();
  const [shownId, setShownId] = useState(null);
  const [cut, setCut] = useState(0);
  const group = useRef();
  const backdrop = useRef();
  const backdropMat = useRef();
  const progress = useRef(0);
  const lastTarget = useRef(VIEW_TURNS[0]);
  const target = VIEW_TURNS[view];

  // عند فتح منتج: نبدأ عرضه
  useEffect(() => {
    if (openId) {
      setShownId(openId);
      onShown(openId);
    }
  }, [openId, onShown]);

  // إذا كان الانتقال بين صورتين بعيدًا نقفز بدل الدوران
  useEffect(() => {
    const prev = lastTarget.current;
    lastTarget.current = target;
    if (Math.abs(target - prev) > JUMP_LIMIT) setCut((c) => c + 1);
  }, [target]);

  // عند إغلاق المنتج نعيد زاوية البداية
  useEffect(() => {
    if (!openId) lastTarget.current = VIEW_TURNS[0];
  }, [openId]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    progress.current = THREE.MathUtils.damp(progress.current, openId ? 1 : 0, 6, step);
    const s = smoothstep(progress.current);

    // انتهى الإغلاق: نزيل المنصة
    if (!openId && shownId && progress.current < 0.01) {
      progress.current = 0;
      setShownId(null);
      onShown(null);
      return;
    }

    // الخلفية المعتمة أمام الكاميرا مباشرة
    camera.getWorldDirection(_fwd);
    backdrop.current.position.copy(camera.position).addScaledVector(_fwd, BACK_DIST);
    backdrop.current.quaternion.copy(camera.quaternion);
    backdropMat.current.opacity = 0.93 * s;
    backdrop.current.visible = s > 0.003;

    if (!shownId || !group.current) return;

    // قياسات الشاشة
    const mobile = size.width < 760;
    const visibleH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const metersPerPx = visibleH / size.height;
    const garmentH = garmentViews[shownId].front.size[1];
    const fit = ((mobile ? 0.36 : 0.74) * visibleH) / garmentH;

    // مساحة العرض الحرة: يسار البطاقة على الكمبيوتر، فوق الورقة السفلية على الجوال
    const offX = mobile ? 0 : -210 * metersPerPx;
    const offY = mobile ? 0.2 * size.height * metersPerPx : 0;

    _right.crossVectors(_fwd, camera.up).normalize();
    _up.crossVectors(_right, _fwd).normalize();
    _origin
      .copy(camera.position)
      .addScaledVector(_fwd, DIST)
      .addScaledVector(_right, offX)
      .addScaledVector(_up, offY + (garmentH * fit) / 2); // أصل القطعة = أعلى الشماعة

    const idx = items.findIndex((p) => p.id === shownId);
    const [rx, ry, rz] = hangPosition(Math.max(idx, 0), items.length);
    _rack.set(rx, ry, rz);

    group.current.position.lerpVectors(_rack, _origin, s);
    group.current.scale.setScalar(lerp(1, fit, s));
  });

  return (
    <>
      <mesh ref={backdrop} renderOrder={5} raycast={() => null} visible={false}>
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial
          ref={backdropMat}
          color="#e4e2dc"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {shownId && (
        <group ref={group}>
          <PhotoGarment
            id={shownId}
            target={target}
            initialTurn={0}
            cutKey={cut}
            castShadows={false}
            renderOrder={10}
          />
        </group>
      )}
    </>
  );
}
