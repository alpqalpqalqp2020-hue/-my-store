import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import PhotoGarment from "./PhotoGarment";
import { BOARD_Z, HAT_STANDOFF, ANCHOR_Y, pickHat } from "./board";
import { WALL_OFFSET } from "./room";
import { pan } from "./pan";

const HOVER_TURN = 0.55; // عند التمرير تدور القبعة قليلًا لتُظهر جانبها
const HOVER_LIFT = 0.05; // وتتقدم نحوك قليلًا
const HOLE_SPACING = 0.025; // ثقب كل 2.5 سم

// نسيج الخشب المثقّب: ثقب صغير يتكرر
function makePegTexture(boardW, boardH) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#dcc59e";
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#b99a6c";
  g.beginPath();
  g.arc(16, 16, 2.6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(boardW / HOLE_SPACING, boardH / HOLE_SPACING);
  t.anisotropy = 8;
  return t;
}

// جدار القبعات: لوح مثقّب عليه قبعات معلّقة بخطّافات صغيرة
export default function CapsWall({ items, board, roomSize, openId, hiddenId, onOpen }) {
  const [hovered, setHovered] = useState(-1);
  const [pinned, setPinned] = useState(-1);
  const active = hovered >= 0 ? hovered : pinned;
  const peg = useMemo(() => makePegTexture(board.boardW, board.boardH), [board.boardW, board.boardH]);
  const boardBack = BOARD_Z - 0.012;

  useEffect(() => {
    if (!openId) {
      setHovered(-1);
      setPinned(-1);
    }
  }, [openId]);

  // أثناء السحب للتنقل نُلغي حالة "المؤشر فوق القبعة"
  useFrame(() => {
    if (pan.dragging) {
      if (hovered !== -1) setHovered(-1);
      if (pinned !== -1) setPinned(-1);
    }
  });

  useEffect(() => {
    document.body.style.cursor = hovered >= 0 && !openId ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, openId]);

  return (
    <group>
      {/* ظل اللوح على الجدار */}
      <mesh position={[0, 1.8, -WALL_OFFSET + 0.004]} receiveShadow>
        <planeGeometry args={[roomSize, 3.6]} />
        <shadowMaterial transparent opacity={0.2} color="#3d382e" />
      </mesh>

      {/* اللوح: إطار خشبي + سطح مثقّب */}
      <mesh position={[0, board.centerY, boardBack + 0.01]} castShadow>
        <boxGeometry args={[board.boardW + 0.04, board.boardH + 0.04, 0.02]} />
        <meshBasicMaterial color="#c9ad82" toneMapped={false} />
      </mesh>
      <mesh position={[0, board.centerY, BOARD_Z]}>
        <planeGeometry args={[board.boardW, board.boardH]} />
        <meshBasicMaterial map={peg} toneMapped={false} />
      </mesh>
      {/* ظل القبعات على اللوح */}
      <mesh position={[0, board.centerY, BOARD_Z + 0.002]} receiveShadow>
        <planeGeometry args={[board.boardW, board.boardH]} />
        <shadowMaterial transparent opacity={0.22} color="#3d382e" />
      </mesh>

      {items.map((p, i) => (
        <HatItem
          key={p.id}
          id={p.id}
          slot={board.slots[i]}
          turned={active === i}
          hidden={openId === p.id || hiddenId === p.id}
        />
      ))}

      {/* منطقة تفاعل لكل قبعة */}
      {!openId &&
        items.map((p, i) => {
          const s = board.slots[i];
          const cy = s.yAnchor - (0.5 - ANCHOR_Y) * s.h;
          return (
            <mesh
              key={p.id}
              position={[s.x, cy, BOARD_Z + HAT_STANDOFF + 0.1]}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!pan.dragging) setHovered(i);
              }}
              onPointerOut={() => setHovered((cur) => (cur === i ? -1 : cur))}
              onClick={(e) => {
                e.stopPropagation();
                if (pan.moved) return; // كان سحبًا وليس نقرة
                const touch = (e.pointerType ?? e.nativeEvent?.pointerType) === "touch";
                if (touch && pinned !== i) setPinned(i); // اللمسة الأولى: تدور القبعة
                else onOpen(p.id); // النقرة بالفأرة، أو اللمسة الثانية: افتح المنتج
              }}
            >
              <planeGeometry args={[s.w * 1.3 + 0.06, s.h * 1.4 + 0.06]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          );
        })}
    </group>
  );
}

const _up = new THREE.Vector3(0, 1, 0);
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _dir = new THREE.Vector3();

// قبعة واحدة على خطّافها: لوحة صغيرة على اللوح تحت الحافة، وساق رفيعة تصعد إلى داخل التاج
function HatItem({ id, slot, turned, hidden }) {
  const group = useRef();
  const rod = useRef();
  const lift = useRef(0);
  const z0 = BOARD_Z + HAT_STANDOFF;

  useFrame((_, dt) => {
    lift.current = THREE.MathUtils.damp(lift.current, turned ? HOVER_LIFT : 0, 12, Math.min(dt, 0.05));
    group.current.position.set(slot.x, slot.yAnchor, z0 + lift.current);
    // الساق تمتد من اللوحة الثابتة إلى نقطة التعليق المتحركة (ترتفع مع القبعة)
    _p0.set(slot.x, slot.plateY, BOARD_Z + 0.008);
    _p1.set(slot.x, slot.yAnchor, z0 + lift.current - 0.004);
    _dir.subVectors(_p1, _p0);
    const len = _dir.length();
    rod.current.position.copy(_p0).addScaledVector(_dir, 0.5);
    rod.current.quaternion.setFromUnitVectors(_up, _dir.normalize());
    rod.current.scale.set(1, len, 1);
  });

  return (
    <group>
      {/* لوحة الخطّاف الصغيرة */}
      <mesh position={[slot.x, slot.plateY, BOARD_Z + 0.006]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.012]} />
        <meshBasicMaterial color="#cfd0d6" toneMapped={false} />
      </mesh>
      {/* الساق */}
      <mesh ref={rod} castShadow>
        <cylinderGeometry args={[0.0035, 0.0035, 1, 10]} />
        <meshBasicMaterial color="#cfd0d6" toneMapped={false} />
      </mesh>
      <group ref={group} position={[slot.x, slot.yAnchor, z0]}>
        <Suspense fallback={null}>
          <PhotoGarment
            id={id}
            initialTurn={0}
            target={turned ? HOVER_TURN : 0}
            hidden={hidden}
            fadeIn
          />
        </Suspense>
      </group>
    </group>
  );
}
