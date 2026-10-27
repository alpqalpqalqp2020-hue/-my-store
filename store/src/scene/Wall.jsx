import { useMemo } from "react";
import * as THREE from "three";

// موضع الجدار خلف القضيب (بالمتر). القضيب عند z = 0
export const WALL_Z = -0.32;
const WALL_W = 14;
const WALL_H = 6;

// نرسم نقطة واحدة صغيرة على لوحة 64×64 ونكررها على كل الجدار
function makeDotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#e4e2dc";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#d1cec5";
  g.beginPath();
  g.arc(32, 32, 2.6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(WALL_W / 0.1, WALL_H / 0.1); // نقطة كل 10 سم
  t.anisotropy = 8;
  return t;
}

// تدرّج دائري: وسط أفتح قليلًا وأطراف أغمق (يعطي إحساس إضاءة موجّهة)
function makeVignetteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,0.30)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.0)");
  grad.addColorStop(1, "rgba(95,85,70,0.30)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function Wall() {
  const dots = useMemo(makeDotTexture, []);
  const vignette = useMemo(makeVignetteTexture, []);
  const cy = WALL_H / 2;

  return (
    <group>
      {/* الجدار نفسه: مادة بلا إضاءة حتى يبقى اللون كما هو تمامًا */}
      <mesh position={[0, cy, WALL_Z]}>
        <planeGeometry args={[WALL_W, WALL_H]} />
        <meshBasicMaterial map={dots} toneMapped={false} />
      </mesh>

      {/* طبقة التدرّج الدائري */}
      <mesh position={[0, 1.7, WALL_Z + 0.001]}>
        <planeGeometry args={[7, 4.4]} />
        <meshBasicMaterial map={vignette} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {/* طبقة تلتقط الظلال فقط (تظهر ظل القطعة على الجدار) */}
      <mesh position={[0, cy, WALL_Z + 0.002]} receiveShadow>
        <planeGeometry args={[WALL_W, WALL_H]} />
        <shadowMaterial transparent opacity={0.2} color="#3d382e" />
      </mesh>
    </group>
  );
}
