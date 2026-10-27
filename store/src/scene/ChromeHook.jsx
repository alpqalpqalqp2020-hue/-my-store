import { useMemo } from "react";
import * as THREE from "three";

// خطّاف معدني يلتف فوق القضيب. نقطة (0,0,0) هي محور القضيب.
// ينتهي طرفه السفلي عند (0, -length, rho) حيث تعلّق الشماعة.
export const RAIL_RADIUS = 0.014;
export const HOOK_LENGTH = 0.075;
export const HOOK_Z = RAIL_RADIUS + 0.003;

export default function ChromeHook() {
  const geometry = useMemo(() => {
    const rho = HOOK_Z;
    const pts = [];
    pts.push(new THREE.Vector3(0, -HOOK_LENGTH, rho));
    pts.push(new THREE.Vector3(0, -rho * 1.4, rho));
    // قوس فوق القضيب من الأمام (زاوية 0) إلى الخلف (زاوية π)
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI;
      pts.push(new THREE.Vector3(0, Math.sin(a) * rho, Math.cos(a) * rho));
    }
    pts.push(new THREE.Vector3(0, -rho * 1.2, -rho));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    return new THREE.TubeGeometry(curve, 90, 0.0022, 8, false);
  }, []);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#f4f4f6" metalness={1} roughness={0.12} />
    </mesh>
  );
}
