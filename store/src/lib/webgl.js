// هل يدعم هذا المتصفح الرسوم ثلاثية الأبعاد (WebGL)؟
export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
