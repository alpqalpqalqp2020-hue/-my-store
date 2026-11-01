import { WALL_Z } from "./Wall";
import { RAIL_RADIUS } from "./ChromeHook";

// قضيب الملابس المعدني مع حوامل تثبّته بالجدار (حامل كل ~1.5 متر).
// محور القضيب عند (0, y, 0).
export default function Rail({ length = 3, y = 1.75 }) {
  const count = Math.max(2, Math.ceil(length / 1.6) + 1);
  const first = -length / 2 + 0.15;
  const last = length / 2 - 0.15;
  const brackets = Array.from({ length: count }, (_, i) => first + ((last - first) * i) / (count - 1));
  const bracketLen = -WALL_Z;

  const chrome = <meshStandardMaterial color="#ececef" metalness={1} roughness={0.16} />;

  return (
    <group position={[0, y, 0]}>
      {/* القضيب */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[RAIL_RADIUS, RAIL_RADIUS, length, 40]} />
        {chrome}
      </mesh>

      {/* غطاءان لطرفي القضيب */}
      {[-length / 2, length / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <sphereGeometry args={[RAIL_RADIUS, 20, 14]} />
          {chrome}
        </mesh>
      ))}

      {/* الحوامل: ساق قصيرة + قرص على الجدار */}
      {brackets.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0, WALL_Z / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.007, 0.007, bracketLen, 16]} />
            {chrome}
          </mesh>
          <mesh position={[0, 0, WALL_Z + 0.005]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.01, 32]} />
            {chrome}
          </mesh>
        </group>
      ))}
    </group>
  );
}
