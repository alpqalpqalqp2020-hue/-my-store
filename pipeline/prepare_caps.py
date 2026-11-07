"""
prepare_caps.py  -  تجهيز صور القبعات للويب
=============================================

يشبه prepare_views.py لكن للقبعات:
  - لا يوجد خطّاف فضي ولا شماعة، فلا نقصّ شيئًا من الأعلى
  - نقطة التعليق داخل القبعة: على ارتفاع 30% من أعلاها، وفي منتصف التاج أفقيًا
  - نسجّل "الحافة" (rim): أسفل صف عريض في القبعة، ليلتقي الخطّاف بها
  - مقاس القبعة الحقيقي يُعطى بالمتر (عرضها من الأمام)، وتُحسب منه كل المقاسات

طريقة الاستخدام (يشغّله make_cap.py عادةً، فلا تحتاج لتشغيله بنفسك):
  python pipeline\\prepare_caps.py cap-navy --width 0.20
"""

import os
import sys
import json
import argparse

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import prepare_views as pv  # noqa: E402  (نعيد استعمال دوال القص والتجهيز)

ANCHOR_Y = 0.3  # نقطة التعليق: 30% من أعلى القبعة


def crown_center_x(im):
    """مركز التاج أفقيًا: متوسط مواضع البكسلات في الصفوف العليا (التاج بلا حافة)."""
    h, w = im.shape[:2]
    a = im[..., 3] > 8
    y0, y1 = int(h * 0.05), int(h * 0.40)
    xs = np.where(a[y0:y1])[1]
    return float(xs.mean()) if len(xs) else w / 2.0


def rim_fraction(im):
    """أسفل صف عرضه لا يقل عن نصف أقصى عرض (نسبة من ارتفاع الصورة)."""
    a = im[..., 3] > 8
    widths = a.sum(axis=1)
    rows = np.where(widths >= 0.5 * widths.max())[0]
    return float((rows.max() + 1) / im.shape[0])


def prepare_view(src, flip):
    im = pv.normalise(pv.load_rgba(src))
    if flip:
        im = cv2.flip(im, 1)
    im, _, _ = pv.trim(im, 0)
    h, w = im.shape[:2]
    cx = crown_center_x(im)
    rim = rim_fraction(im)
    im = pv.edge_bleed(im)
    return im, cx / w, rim


def main():
    p = argparse.ArgumentParser(description="تجهيز صور القبعات للويب")
    p.add_argument("product_id")
    p.add_argument("--width", type=float, default=0.20, help="عرض القبعة الحقيقي من الأمام بالمتر")
    p.add_argument("--front", default="front")
    p.add_argument("--back", default="back")
    p.add_argument("--side", default="side")
    p.add_argument("--side-faces", choices=["left", "right"], default="left",
                   help="اتجاه حافة القبعة (الفيزور) في الصورة الجانبية المولَّدة")
    p.add_argument("--cutouts", default="pipeline/cutouts")
    p.add_argument("--out", default="store/public/garments")
    p.add_argument("--manifest", default="store/src/data/garmentViews.json")
    args = p.parse_args()

    in_dir = os.path.join(args.cutouts, args.product_id)
    out_dir = os.path.join(args.out, args.product_id)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(os.path.dirname(args.manifest), exist_ok=True)

    names = {"front": args.front, "back": args.back, "side": args.side}
    flips = {"front": False, "back": False, "side": args.side_faces == "left"}

    prepared = {}
    for view, name in names.items():
        src = os.path.join(in_dir, name + ".png")
        if not os.path.exists(src):
            raise SystemExit(f"Missing file: {src}")
        prepared[view] = prepare_view(src, flips[view])

    # المقياس من عرض القبعة الأمامية: كم متر يمثل كل بكسل
    fim = prepared["front"][0]
    front_px = fim.shape[1] - 2 * pv.PADDING
    mpp = args.width / front_px

    entry = {}
    for view, (im, ax, rim) in prepared.items():
        h, w = im.shape[:2]
        dst = os.path.join(out_dir, view + ".webp")
        px = pv.save_webp(im, dst)
        kb = os.path.getsize(dst) / 1024
        entry[view] = {
            "size": [round(w * mpp, 4), round(h * mpp, 4)],
            "anchor": [round(ax, 4), ANCHOR_Y],
            "rim": round(rim, 4),
        }
        print(f"  {view:5s} -> {dst}  {px[0]}x{px[1]} px, {kb:.0f} KB, "
              f"size {entry[view]['size'][0]} x {entry[view]['size'][1]} m, rim {rim:.2f}")

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
