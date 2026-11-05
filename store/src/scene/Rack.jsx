import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Rail from "./Rail";
import ChromeHook from "./ChromeHook";
import PhotoGarment, { REST_TURN } from "./PhotoGarment";
import { RAIL_Y, HOOK_Z } from "./constants";
import { hangPosition, pickIndex, slideOffset } from "./layout";
import { pan } from "./pan";

// قضيب الملابس: قضيب + قطع معلّقة متقاربة + منطقة تفاعل واحدة غير مرئية
export default function Rack({ items, layout, openId, hiddenId, onOpen }) {
  const root = useRef(null); // لتحويل موضع المؤشر إلى إحداثيات القسم
  const [hovered, setHovered] = useState(-1); // القطعة التي يقف عليها المؤشر
  const [pinned, setPinned] = useState(-1); // القطعة المثبّتة باللمس
  const active = hovered >= 0 ? hovered : pinned; // القطعة المفتوحة الآن (تواجهك)

  const length = Math.max(3, layout.railLength);
  const zoneW = layout.xs[layout.n - 1] - layout.xs[0] + layout.maxFront + 0.1;

  // عند إغلاق المنتج نعيد القطع إلى وضع الراحة
  useEffect(() => {
    if (!openId) {
      setHovered(-1);
      setPinned(-1);
    }
  }, [openId]);

  // أثناء السحب للتنقل نُلغي حالة "المؤشر فوق القطعة"
  useFrame(() => {
    if (pan.dragging) {
      if (hovered !== -1) setHovered(-1);
      if (pinned !== -1) setPinned(-1);
    }
  });

  // شكل المؤشر: يد عند الوقوف فوق قطعة
  useEffect(() => {
    document.body.style.cursor = hovered >= 0 && !openId ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, openId]);

  return (
    <group ref={root}>
      <Rail length={length} y={RAIL_Y} />

      {items.map((p, i) => (
        <SwayingHanger
          key={p.id}
          x={layout.xs[i]}
          slide={slideOffset(layout, active, i)}
          lift={active === i ? 0.04 : 0}
          seed={i}
        >
          <ChromeHook />
          {/* كل قطعة في Suspense خاص بها: الغرفة تظهر فورًا ولا تنتظر الصور */}
          <Suspense fallback={null}>
            <PhotoGarment
              id={p.id}
              position={[0, hangPosition(layout, i)[1] - RAIL_Y, HOOK_Z + 0.006]}
              hidden={openId === p.id || hiddenId === p.id}
              target={active === i ? 0 : REST_TURN}
              fadeIn
            />
          </Suspense>
        </SwayingHanger>
      ))}

      {/* منطقة تفاعل واحدة فوق كل القطع (تمنع الارتجاف بين القطع) */}
      {!openId && (
        <mesh
          position={[0, RAIL_Y - 0.4, 0.1]}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (pan.dragging) return;
            setHovered((cur) => pickIndex(layout, cur, root.current.worldToLocal(e.point.clone()).x));
          }}
          onPointerOut={() => setHovered(-1)}
          onClick={(e) => {
            e.stopPropagation();
            if (pan.moved) return; // كان سحبًا وليس نقرة
            const i = pickIndex(layout, hovered, root.current.worldToLocal(e.point.clone()).x);
            if (i < 0) return;
            const touch = (e.pointerType ?? e.nativeEvent?.pointerType) === "touch";
            if (touch && pinned !== i) {
              setPinned(i); // اللمسة الأولى: تواجهك القطعة
            } else {
              onOpen(items[i].id); // النقرة بالفأرة، أو اللمسة الثانية: افتح المنتج
            }
          }}
        >
          <planeGeometry args={[Math.max(zoneW, 0.6), 0.95]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// شماعة تتأرجح بلطف، وتنزلق جانبيًا لتفسح للقطعة المفتوحة، وتتقدّم قليلًا عند تفتح.
// ملاحظة: نضبط موضعها في useFrame فقط حتى لا يعيده React إلى مكانه.
function SwayingHanger({ x, slide, lift, seed, children }) {
  const ref = useRef();
  const cur = useRef({ slide: 0, lift: 0 });
  useFrame(({ clock }, dt) => {
    const step = Math.min(dt, 0.05);
    cur.current.slide = THREE.MathUtils.damp(cur.current.slide, slide, 12, step);
    cur.current.lift = THREE.MathUtils.damp(cur.current.lift, lift, 12, step);
    ref.current.position.x = x + cur.current.slide;
    ref.current.position.z = cur.current.lift;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.1 + seed * 1.7) * 0.012;
  });
  return (
    <group ref={ref} position={[x, RAIL_Y, 0]}>
      {children}
    </group>
  );
}
