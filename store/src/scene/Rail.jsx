import { WALL_Z } from "./Wall";
import { RAIL_RADIUS } from "./ChromeHook";

// قضيب الملابس المعدني مع حاملَين يثبّتانه بالجدار.
// محور القضيب عند (0, y, 0).
export default function Rail({ length = 3, y = 1.75 }) {
  const brackets = [-length / 2 + 0.15, length / 2 - 0.15];
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

      {/* الحاملان: ساق قصيرة + قرص على الجدار */}
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
