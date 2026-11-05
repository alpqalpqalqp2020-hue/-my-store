// ============================================================
// هندسة الغرفة: مربعة، ولكل جدار قسم. دوال بسيطة بلا رسم.
// الجدار الأول (k=0) خلف القضيب في موضعه الحالي، وبقية الجدران حوله.
// ============================================================

export const ROOM_H = 3.6; // ارتفاع الغرفة (بالمتر)
export const WALL_OFFSET = 0.32; // بُعد الجدار خلف محور القضيب
const MIN_SIZE = 7; // أصغر ضلع للغرفة

// railLengths = أطوال القضبان/العروض المطلوبة (لتتسع الغرفة لأطولها)
export function makeRoom(railLengths = []) {
  const size = Math.max(MIN_SIZE, ...railLengths.map((l) => l + 1.6));
  const half = size / 2;
  // مركز الغرفة: بحيث يكون محور القسم الأول عند الأصل (0,0,0)
  const center = [0, 0, half - WALL_OFFSET];
  return { size, half, center, height: ROOM_H };
}

// إطار القسم k: موضعه ودورانه حول المحور الرأسي. (محوره المحلي +z يتجه نحو مركز الغرفة)
export function sectionFrame(k, room) {
  const rotationY = -k * (Math.PI / 2);
  const reach = room.half - WALL_OFFSET;
  const s = Math.sin(rotationY);
  const c = Math.cos(rotationY);
  const position = [room.center[0] - s * reach, 0, room.center[2] - c * reach];
  return { k, rotationY, position };
}

// نقطة محلية (في إطار القسم) ← إلى إحداثيات العالم
export function toWorld(frame, v) {
  const s = Math.sin(frame.rotationY);
  const c = Math.cos(frame.rotationY);
  return [
    frame.position[0] + v[0] * c + v[2] * s,
    frame.position[1] + v[1],
    frame.position[2] - v[0] * s + v[2] * c,
  ];
}

// نقطة في العالم ← إلى إحداثيات إطار القسم
export function toLocal(frame, w) {
  const s = Math.sin(frame.rotationY);
  const c = Math.cos(frame.rotationY);
  const dx = w[0] - frame.position[0];
  const dz = w[2] - frame.position[2];
  return [dx * c - dz * s, w[1] - frame.position[1], dx * s + dz * c];
}

// اتجاه النظر في الغرفة: yaw=0 ينظر نحو الجدار الأول، والموجب يدور لليسار
export function lookDirection(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

// أقرب زاوية مكافئة للهدف (تمنع الدوران الكامل غير الضروري)
export function nearestAngle(target, current) {
  const TAU = Math.PI * 2;
  return target + TAU * Math.round((current - target) / TAU);
}
