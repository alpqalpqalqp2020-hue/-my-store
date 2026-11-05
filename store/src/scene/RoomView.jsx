import { useMemo } from "react";
import * as THREE from "three";
import { sectionFrame, toWorld } from "./room";

// أرضية خرسانة بتدرّج ناعم: أفتح في الوسط وأغمق قرب الجدران (مضمونة على كل الأجهزة)
function makeFloorTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 20, 128, 128, 182);
  grad.addColorStop(0, "#dad6cc");
  grad.addColorStop(0.6, "#c9c4b9");
  grad.addColorStop(1, "#b2ada2");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// الغرفة: أرضية + سقف بإضاءة + جدران سادة للأقسام التي لم تُبنَ بعد + وزرة سفلية
export default function Room({ room, decorated }) {
  const { size, center, height } = room;
  const floor = useMemo(makeFloorTexture, []);

  return (
    <group>
      {/* الأرضية */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], 0, center[2]]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={floor} toneMapped={false} />
      </mesh>

      {/* السقف وشريطا إضاءة */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[center[0], height, center[2]]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#f1efea" toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[Math.PI / 2, 0, 0]} position={[center[0] + s * size * 0.22, height - 0.01, center[2]]}>
          <planeGeometry args={[0.28, size * 0.7]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}

      {/* الجدران الأربعة: السادة منها للأقسام غير المبنية، والوزرة لكلها */}
      {[0, 1, 2, 3].map((k) => {
        const frame = sectionFrame(k, room);
        const mid = toWorld(frame, [0, height / 2, -0.32]);
        const base = toWorld(frame, [0, 0.045, -0.32 + 0.008]);
        return (
          <group key={k}>
            {k >= decorated && (
              <mesh position={mid} rotation={[0, frame.rotationY, 0]}>
                <planeGeometry args={[size, height]} />
                <meshBasicMaterial color="#e4e2dc" toneMapped={false} />
              </mesh>
            )}
            <mesh position={base} rotation={[0, frame.rotationY, 0]}>
              <boxGeometry args={[size, 0.09, 0.016]} />
              <meshBasicMaterial color="#d7d3ca" toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
