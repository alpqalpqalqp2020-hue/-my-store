import { HOOK_LENGTH, HOOK_Z, RAIL_Y } from "./constants.js";

// ============================================================
// ترتيب القطع على القضيب (دوال بسيطة بلا رسم، سهلة الاختبار)
// ============================================================

const MIN_THICK = 0.18; // أقل سماكة جانبية للقطعة (بالمتر)
const GAP = 0.04; // فراغ صغير بين القطع
const HOVER_GAP = 0.12; // فراغ تتركه الجارات حول القطعة المفتوحة
const HYSTERESIS = 0.03; // هامش يمنع الارتجاف عند حافة القطعة

// views = محتوى garmentViews.json
export function computeLayout(items, views) {
  const n = items.length;
  // سماكة كل قطعة وهي معلّقة جانبيًا
  const thick = items.map(
    (p) => Math.max(views[p.id]?.side.size[0] ?? MIN_THICK, MIN_THICK) + GAP
  );
  // عرض كل قطعة وهي تواجهك
  const front = items.map((p) => views[p.id]?.front.size[0] ?? 0.6);

  // نضع القطع متجاورة بحسب سماكتها ثم نوسّط المجموعة حول الصفر
  const raw = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) x += (thick[i - 1] + thick[i]) / 2;
    raw.push(x);
  }
  const mid = n ? (raw[0] + raw[n - 1]) / 2 : 0;
  const xs = raw.map((v) => v - mid);

  // كم تنزاح الجارات عندما تُفتح قطعة: نصف اتساعها زيادة + فراغ
  const delta = items.map((_, i) => (front[i] - thick[i]) / 2 + HOVER_GAP);

  const maxFront = Math.max(0.6, ...front);
  const maxDelta = Math.max(0, ...delta);
  const restWidth = n ? xs[n - 1] - xs[0] + (thick[0] + thick[n - 1]) / 2 : 0;
  const railLength = restWidth + 2 * maxDelta + 0.8;

  return { n, xs, thick, front, delta, maxFront, maxDelta, restWidth, railLength };
}

// موضع نقطة تعليق الشماعة في العالم
export const hangPosition = (layout, i) => [layout.xs[i], RAIL_Y - HOOK_LENGTH, HOOK_Z + 0.006];

// كم تنزاح القطعة i عندما تكون القطعة active هي المفتوحة (سالب = يسارًا)
export function slideOffset(layout, active, i) {
  if (active < 0 || i === active) return 0;
  const d = layout.delta[active];
  return i < active ? -d : d;
}

// أي قطعة تحت المؤشر؟ px = موضع المؤشر على القضيب. يرجع -1 إن لم يكن فوق الرف.
// نقرر من أماكن القطع "المستقرة" وليس من أماكنها أثناء الانزلاق،
// ونُبقي القطعة الحالية ما دام المؤشر داخل عرضها (يمنع الارتجاف).
export function pickIndex(layout, current, px) {
  const { n, xs, front, maxFront } = layout;
  if (n === 0) return -1;
  if (px < xs[0] - maxFront / 2 - 0.05 || px > xs[n - 1] + maxFront / 2 + 0.05) return -1;
  if (current >= 0 && current < n && Math.abs(px - xs[current]) <= front[current] / 2 + HYSTERESIS) {
    return current;
  }
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(px - xs[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
