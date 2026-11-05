import { products } from "../data/products";
import garmentViews from "../data/garmentViews.json";
import { CATEGORY_LABELS } from "../data/labels";
import { computeLayout, hangPosition } from "./layout";
import { makeRoom, sectionFrame, toWorld } from "./room";

// ============================================================
// الأقسام: لكل قسم جدار في الغرفة وجهاز عرض.
// الأقسام المدعومة الآن، بترتيب جدرانها. (ستُضاف: caps, bags, shoes)
// ============================================================
const SUPPORTED = ["clothing"];

const built = SUPPORTED.filter((c) => products.some((p) => p.category === c)).map((category) => {
  const items = products.filter((p) => p.category === category);
  return { category, items, layout: computeLayout(items, garmentViews) };
});

export const room = makeRoom(built.map((b) => Math.max(3, b.layout.railLength)));

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
    if (i >= 0) return toWorld(s.frame, hangPosition(s.layout, i));
  }
  return [0, 1.6, 0];
}
