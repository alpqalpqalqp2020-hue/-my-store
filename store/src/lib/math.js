// دوال رياضية صغيرة نستعملها في الحركة

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// خطّي: ينتقل من a إلى b حسب t (من 0 إلى 1)
export const lerp = (a, b, t) => a + (b - a) * t;

// انتقال ناعم (يبدأ ببطء وينتهي ببطء)
export const smoothstep = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};

// انتقال أنعم من السابق
export const smootherstep = (t) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// باقي القسمة مع دعم الأرقام السالبة (mod(-1, 4) = 3)
export const mod = (n, m) => ((n % m) + m) % m;
