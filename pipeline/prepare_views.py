"""
prepare_views.py  -  تجهيز صور القطعة للويب
============================================

ماذا يفعل هذا السكربت؟
  يأخذ صور القص (أمام / خلف / جانب) ويجهّزها للمتجر:
    1) يوحّد مقياس الصور الثلاث (قد تكون أحجامها مختلفة)
    2) يقلب الصورة الجانبية ليواجه أمام القطعة اليمين
    3) يحذف الخطاف الفضي من الصورة (سنضيف خطافًا ثلاثي الأبعاد لاحقًا)
       ويُبقي الشماعة الخشبية
    4) يقص الفراغ الشفاف حول القطعة (هامش 6 بكسل)
    5) يملأ البكسلات الشفافة بأقرب لون من القطعة (يمنع ظهور هالة داكنة)
    6) يصغّر الصورة (أكبر ضلع 1024 بكسل) ويحفظها WebP بجودة 88
    7) يقيس الحجم الحقيقي بالمتر ونقطة تعليق الشماعة ويكتبهما في ملف JSON

طريقة الاستخدام (من مجلد my-store):
  python pipeline\\prepare_views.py hoodie-green

  - يقرأ من:  pipeline\\cutouts\\hoodie-green\\  (img1a أمام، img1b خلف، img1c جانب)
  - يكتب في:  store\\public\\garments\\hoodie-green\\  (front/back/side.webp)
  - ويحدّث:   store\\src\\data\\garmentViews.json

خيارات (اختيارية):
  --front img1a --back img1b --side img1c    أسماء ملفات الأمام والخلف والجانب
  --side-faces left|right                    إلى أين ينظر أمام القطعة في الصورة الجانبية
                                             المولَّدة (الافتراضي left)
"""

import os
import sys
import json
import argparse

import cv2
import numpy as np
from PIL import Image

NORM_SIZE = 1254          # نوحّد كل الصور على مربع بهذا الحجم (مقياس الدليل)
METRES_PER_PIXEL = 0.00066  # كم متر يمثّل كل بكسل بعد التوحيد
PADDING = 6               # هامش حول القطعة بعد القص
MAX_SIDE = 1024           # أكبر ضلع للصورة النهائية
WEBP_QUALITY = 88


# ---------------------------------------------------------------------------
# أدوات صغيرة
# ---------------------------------------------------------------------------
def load_rgba(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im is None or im.ndim != 3 or im.shape[2] != 4:
        raise SystemExit(f"Cannot read a transparent PNG: {path}")
    return im  # BGRA


def normalise(im):
    """يحوّل الصورة إلى مربع NORM_SIZE (لتوحيد المقياس بين الصور)."""
    h, w = im.shape[:2]
    if (h, w) == (NORM_SIZE, NORM_SIZE):
        return im
    interp = cv2.INTER_AREA if w > NORM_SIZE else cv2.INTER_CUBIC
    return cv2.resize(im, (NORM_SIZE, NORM_SIZE), interpolation=interp)


def wood_mask(im):
    """قناع بكسلات الشماعة الخشبية (لون برتقالي/بني فاتح)."""
    bgr = im[..., :3]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return (im[..., 3] > 200) & (h >= 5) & (h <= 25) & (s > 60) & (v > 90)


def cut_off_hook(im):
    """
    يقص كل ما فوق أعلى الشماعة الخشبية (أي الخطاف الفضي).
    يرجع (الصورة بعد القص، موضع x لمركز الشماعة بالبكسل داخل الصورة الجديدة).
    """
    wood = wood_mask(im)
    rows = wood.sum(axis=1)
    candidates = np.where(rows >= 3)[0]
    if len(candidates) == 0:
        raise SystemExit("Could not find the wooden hanger in the image.")
    top = int(candidates[0])

    # مركز الشماعة: متوسط x لبكسلات الخشب في أول 12 صفًا من أعلاها
    band = wood[top: top + 12]
    xs = np.where(band)[1]
    cx = float(xs.mean())
    return im[top:].copy(), cx


def trim(im, cx, pad=PADDING):
    """يقص الفراغ الشفاف حول القطعة، ويرجع الصورة ومركز الشماعة الجديد."""
    a = im[..., 3]
    ys, xs = np.where(a > 8)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, im.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, im.shape[1])
    return im[y0:y1, x0:x1].copy(), cx - x0, y0


def edge_bleed(im):
    """
    يملأ لون البكسلات الشفافة وأنصاف الشفافة بأقرب لون صلب من القطعة.
    بدون هذا تظهر هالة رمادية/داكنة على الحواف عندما يمزج المتصفح الألوان.
    """
    bgr = im[..., :3].copy()
    alpha = im[..., 3]
    solid = alpha >= 230
    # الدالة تحسب لكل بكسل أقرب بكسل "صفري" في الصورة المدخلة، فنجعل الصلب = 0
    src = np.where(solid, 0, 255).astype(np.uint8)
    _, labels = cv2.distanceTransformWithLabels(
        src, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    ys, xs = np.where(solid)
    lut = np.zeros((labels.max() + 1, 3), dtype=np.uint8)
    lut[labels[ys, xs]] = bgr[ys, xs]
    need = ~solid
    bgr[need] = lut[labels[need]]
    out = im.copy()
    out[..., :3] = bgr
    return out


def save_webp(im, path):
    rgba = cv2.cvtColor(im, cv2.COLOR_BGRA2RGBA)
    pil = Image.fromarray(rgba)
    w, h = pil.size
    scale = min(1.0, MAX_SIDE / max(w, h))
    if scale < 1.0:
        pil = pil.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    pil.save(path, "WEBP", quality=WEBP_QUALITY, method=6)
    return pil.size


# ---------------------------------------------------------------------------
# المعالجة الرئيسية
# ---------------------------------------------------------------------------
def prepare_view(src_path, flip=False):
    im = normalise(load_rgba(src_path))
    if flip:
        im = cv2.flip(im, 1)  # قلب أفقي
    im, cx = cut_off_hook(im)
    im, cx, _ = trim(im, cx)
    im = edge_bleed(im)

    h, w = im.shape[:2]
    size_m = [round(w * METRES_PER_PIXEL, 4), round(h * METRES_PER_PIXEL, 4)]
    anchor = [round(cx / w, 4), round(PADDING / h, 4)]
    return im, size_m, anchor


def main():
    p = argparse.ArgumentParser(description="تجهيز صور القطعة للويب")
    p.add_argument("product_id", help="معرّف المنتج، مثل hoodie-green")
    p.add_argument("--front", default="img1a")
    p.add_argument("--back", default="img1b")
    p.add_argument("--side", default="img1c")
    p.add_argument("--side-faces", choices=["left", "right"], default="left",
                   help="اتجاه أمام القطعة في الصورة الجانبية المولَّدة")
    p.add_argument("--cutouts", default="pipeline/cutouts")
    p.add_argument("--out", default="store/public/garments")
    p.add_argument("--manifest", default="store/src/data/garmentViews.json")
    args = p.parse_args()

    in_dir = os.path.join(args.cutouts, args.product_id)
    out_dir = os.path.join(args.out, args.product_id)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(os.path.dirname(args.manifest), exist_ok=True)

    views = {
        "front": (args.front, False),
        "back": (args.back, False),
        # الجانبية: نقلبها إذا كان الأمام ينظر لليسار ليصبح ينظر لليمين
        "side": (args.side, args.side_faces == "left"),
    }

    entry = {}
    for view, (name, flip) in views.items():
        src = os.path.join(in_dir, name + ".png")
        if not os.path.exists(src):
            raise SystemExit(f"Missing file: {src}")
        im, size_m, anchor = prepare_view(src, flip=flip)
        dst = os.path.join(out_dir, view + ".webp")
        px = save_webp(im, dst)
        kb = os.path.getsize(dst) / 1024
        entry[view] = {"size": size_m, "anchor": anchor}
        print(f"  {view:5s} -> {dst}  {px[0]}x{px[1]} px, {kb:.0f} KB, "
              f"size {size_m[0]} x {size_m[1]} m")

    # نقرأ ملف البيانات الحالي ونضيف/نحدّث هذا المنتج فقط
    data = {}
    if os.path.exists(args.manifest):
        with open(args.manifest, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = {}
    data[args.product_id] = entry
    with open(args.manifest, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Updated {args.manifest}")
    print("Done.")


if __name__ == "__main__":
    main()
