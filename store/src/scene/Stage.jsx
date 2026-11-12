import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import PhotoGarment from "./PhotoGarment";
import garmentViews from "../data/garmentViews.json";
import { lerp, smoothstep } from "../lib/math";
import { fillFor } from "./sections";
import { insets } from "./insets";

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

export default function Stage({ hangWorld, openId, view, onShown }) {
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

    // قياسات الشاشة والمساحة الحرة (ما لا تغطيه الترويسة والبطاقة والصور المصغّرة)
    const W = size.width;
    const H = size.height;
    const visibleH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const metersPerPx = visibleH / H;
    const front = garmentViews[shownId].front;
    const garmentW = front.size[0];
    const garmentH = front.size[1];
    const anchorY = front.anchor[1]; // موضع نقطة التعليق من أعلى الصورة

    const availW = Math.max(W - insets.left - insets.right, 120);
    const availH = Math.max(H - insets.top - insets.bottom, 120);
    const fill = fillFor(shownId); // نسبة ما تشغله القطعة من المساحة الحرة
    // نكبّر القطعة حتى تملأ المساحة الحرة طولًا أو عرضًا (أيهما أضيق)، فلا تُقصّ أبدًا
    const fit = Math.min(
      (fill * availH * metersPerPx) / garmentH,
      (fill * availW * metersPerPx) / garmentW
    );
    // مركز المساحة الحرة نسبةً إلى مركز الشاشة
    const offX = (insets.left + availW / 2 - W / 2) * metersPerPx;
    const offY = (H / 2 - (insets.top + availH / 2)) * metersPerPx;

    _right.crossVectors(_fwd, camera.up).normalize();
    _up.crossVectors(_right, _fwd).normalize();
    _origin
      .copy(camera.position)
      .addScaledVector(_fwd, DIST)
      .addScaledVector(_right, offX)
      .addScaledVector(_up, offY + (0.5 - anchorY) * garmentH * fit); // أصل القطعة = نقطة تعليقها

    const [rx, ry, rz] = hangWorld(shownId); // نقطة تعليقها في الغرفة (في العالم)
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
          <Suspense fallback={null}>
            <PhotoGarment
              id={shownId}
              target={target}
              initialTurn={0}
              cutKey={cut}
              castShadows={false}
              renderOrder={10}
            />
          </Suspense>
        </group>
      )}
    </>
  );
}
