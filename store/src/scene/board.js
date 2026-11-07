// ============================================================
// ترتيب القبعات على اللوح المثقّب (دوال بسيطة بلا رسم، سهلة الاختبار)
// اللوح صفّان، وتُملأ القبعات من اليمين... من الأعلى إلى الأسفل بالترتيب.
// ============================================================

export const BOARD_ROWS = 2;
const COL_SPACING = 0.56; // المسافة الأفقية بين القبعات (متر)
const ROW_SPACING = 0.52; // المسافة الرأسية بين الصفين
const BOARD_CENTER_Y = 1.45; // ارتفاع مركز اللوح
const PAD = 0.28; // هامش اللوح حول القبعات
export const ANCHOR_Y = 0.3; // موضع نقطة التعليق داخل القبعة (من أعلاها)
export const BOARD_Z = -0.32 + 0.012; // سطح اللوح الأمامي (المحلي)
export const HAT_STANDOFF = 0.075; // بُعد القبعة عن اللوح

// views = محتوى garmentViews.json
export function computeBoard(items, views) {
  const n = items.length;
  const cols = Math.max(2, Math.ceil(n / BOARD_ROWS));
  const slots = items.map((p, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const v = views[p.id]?.front;
    const h = v?.size[1] ?? 0.17;
    const w = v?.size[0] ?? 0.2;
    const rim = v?.rim ?? 0.8; // أسفل حافة القبعة (نسبة من ارتفاعها)
    const ay = v?.anchor[1] ?? ANCHOR_Y;
    const x = (col - (cols - 1) / 2) * COL_SPACING;
    const slotY = BOARD_CENTER_Y + (0.5 - row) * ROW_SPACING;
    // نضع مركز القبعة في مركز الخانة، فتكون نقطة التعليق فوق المركز بقدر (0.5 - ay) * h
    const yAnchor = slotY + (0.5 - ay) * h;
    const plateY = yAnchor - (rim - ay) * h - 0.028; // اللوحة الصغيرة تحت حافة القبعة
    return { x, yAnchor, plateY, w, h, row, col };
  });
  const boardW = cols * COL_SPACING + PAD * 2 - (COL_SPACING - 0.3);
  const boardH = BOARD_ROWS * ROW_SPACING + PAD * 2 - 0.1;
  return { n, cols, rows: BOARD_ROWS, slots, boardW, boardH, centerY: BOARD_CENTER_Y };
}

// أي قبعة تحت المؤشر؟ (محلي x,y). يرجع -1 إن لم يكن فوق أي قبعة.
export function pickHat(board, x, y) {
  let best = -1;
  let bestD = Infinity;
  board.slots.forEach((s, i) => {
    const cy = s.yAnchor + (0.5 - ANCHOR_Y) * -s.h; // مركز القبعة تقريبًا
    const dx = Math.abs(x - s.x) / (s.w * 0.65 + 0.04);
    const dy = Math.abs(y - cy) / (s.h * 0.65 + 0.04);
    const d = Math.max(dx, dy);
    if (d <= 1 && d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
