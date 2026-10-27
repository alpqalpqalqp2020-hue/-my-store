import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import Rail from "./Rail";
import ChromeHook, { HOOK_LENGTH, HOOK_Z } from "./ChromeHook";
import PhotoGarment, { REST_TURN } from "./PhotoGarment";

const RAIL_Y = 1.75;
const SPACING = 0.7; // المسافة بين القطع على القضيب

// قضيب الملابس: قضيب + قطع معلّقة + منطقة تفاعل واحدة غير مرئية
export default function Rack({ items }) {
  const n = items.length;
  const length = Math.max(3, n * SPACING + 0.8);
  const xs = items.map((_, i) => (i - (n - 1) / 2) * SPACING);

  const [hovered, setHovered] = useState(-1); // القطعة التي يقف عليها المؤشر
  const [pinned, setPinned] = useState(-1); // القطعة المثبّتة بالنقر/اللمس

  // شكل المؤشر: يد عند الوقوف فوق قطعة
  useEffect(() => {
    document.body.style.cursor = hovered >= 0 ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  // نختار أقرب قطعة لموضع المؤشر على القضيب
  const pick = (x) => {
    let best = -1;
    let bestDist = Infinity;
    xs.forEach((px, i) => {
      const d = Math.abs(x - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return bestDist < SPACING / 2 + 0.06 ? best : -1;
  };

  return (
    <group>
      <Rail length={length} y={RAIL_Y} />

      {items.map((p, i) => (
        <SwayingHanger key={p.id} x={xs[i]} seed={i}>
          <ChromeHook />
          <PhotoGarment
            id={p.id}
            position={[0, -HOOK_LENGTH, HOOK_Z + 0.006]}
            target={hovered === i || pinned === i ? 0 : REST_TURN}
          />
        </SwayingHanger>
      ))}

      {/* منطقة تفاعل واحدة فوق كل القطع (تمنع الارتجاف بين القطع) */}
      <mesh
        position={[0, RAIL_Y - 0.4, 0.1]}
        onPointerMove={(e) => {
          e.stopPropagation();
          setHovered(pick(e.point.x));
        }}
        onPointerOut={() => setHovered(-1)}
        onClick={(e) => {
          e.stopPropagation();
          const i = pick(e.point.x);
          setPinned((cur) => (cur === i ? -1 : i));
        }}
      >
        <planeGeometry args={[length, 0.95]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// مجموعة تتأرجح بلطف مثل شماعة معلّقة. تدور حول نقطة القضيب.
function SwayingHanger({ x, seed, children }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 1.1 + seed * 1.7) * 0.012;
  });
  return (
    <group ref={ref} position={[x, RAIL_Y, 0]}>
      {children}
    </group>
  );
}
