import { products } from "../data/products";
import garmentViews from "../data/garmentViews.json";
import { CATEGORY_LABELS } from "../data/labels";
import { computeLayout, hangPosition } from "./layout";
import { computeBoard, BOARD_Z, HAT_STANDOFF } from "./board";
import { makeRoom, sectionFrame, toWorld } from "./room";
import { clamp } from "../lib/math";

// ============================================================
// الأقسام: لكل قسم جدار في الغرفة وجهاز عرض.
// الأقسام الجاهزة الآن بترتيب جدرانها. (ستُضاف: shoes, bags)
// ============================================================
const SUPPORTED = ["clothing", "caps"];

// كم من ارتفاع الشاشة تشغله القطعة عند فتحها (القبعة الصغيرة أقل لئلا تتضخم)
const FILL_DESKTOP = { clothing: 0.74, caps: 0.55 };
const FILL_MOBILE = { clothing: 0.36, caps: 0.3 };
const PORTRAIT_VIEW_W = 1.1; // عرض الجدار الظاهر على الجوال (بالمتر)

function build(category) {
  const items = products.filter((p) => p.category === category);

  if (category === "caps") {
    const board = computeBoard(items, garmentViews);
    return {
      category,
      kind: "pegboard",
      items,
      board,
      ownWall: false, // الغرفة ترسم الجدار السادة خلف اللوح
      extent: board.boardW + 0.6,
      cam: { eyeY: 1.45, targetY: 1.4 },
      viewW: (aspect) => (aspect < 1 ? 1.4 : clamp(board.boardW + 0.8, 3.0, 4.4)),
    };
  }

  const layout = computeLayout(items, garmentViews);
  return {
    category,
    kind: "rack",
    items,
    layout,
    ownWall: true, // للملابس جدارها المنقّط الخاص
    extent: Math.max(3, layout.railLength),
    cam: { eyeY: 1.4, targetY: 0.95 },
    viewW: (aspect) =>
      aspect < 1 ? PORTRAIT_VIEW_W : clamp(layout.restWidth + 2 * layout.maxDelta + 1.2, 3.4, 4.4),
  };
}

const built = SUPPORTED.filter((c) => products.some((p) => p.category === c)).map(build);

export const room = makeRoom(built.map((b) => b.extent));

export const sections = built.map((b, k) => ({
  id: b.category,
  label: CATEGORY_LABELS[b.category] ?? b.category,
  ...b,
  frame: sectionFrame(k, room),
}));

// موضع نقطة تعليق قطعة في العالم (تبدأ منه رحلتها عند فتح المنتج)
export function hangWorld(id) {
  for (const s of sections) {
    const i = s.items.findIndex((p) => p.id === id);
    if (i < 0) continue;
    if (s.kind === "pegboard") {
      const slot = s.board.slots[i];
      return toWorld(s.frame, [slot.x, slot.yAnchor, BOARD_Z + HAT_STANDOFF]);
    }
    return toWorld(s.frame, hangPosition(s.layout, i));
  }
  return [0, 1.6, 0];
}

// نسبة الشاشة التي تشغلها القطعة المفتوحة
export function fillFor(id, mobile) {
  const category = products.find((p) => p.id === id)?.category;
  const table = mobile ? FILL_MOBILE : FILL_DESKTOP;
  return table[category] ?? table.clothing;
}
