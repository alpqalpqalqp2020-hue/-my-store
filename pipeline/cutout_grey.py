"""
cutout_grey.py  -  قص المنتج من الخلفية الرمادية
=================================================

ماذا يفعل هذا السكربت؟
  يأخذ صور المنتجات (خلفية رمادية مسطحة) ويحفظ كل صورة بخلفية شفافة (PNG).
  ويحفظ بجانب كل صورة نسخة "فحص" على خلفية ماجنتا (وردي فاقع) لترى
  بقايا الرمادي بسهولة.

طريقة الاستخدام (من مجلد my-store):
  python pipeline\\cutout_grey.py generated\\clothes pipeline\\cutouts\\hoodie-green

  - الأول: مجلد الصور المولّدة (أو صورة واحدة)
  - الثاني: مجلد الإخراج (ينشأ تلقائيًا)

خيارات إضافية (اختيارية):
  --tol 14      حساسية الفصل عن الخلفية (الأعلى = يقص أكثر)
  --peel 2      عدد البكسلات التي تُقشَّر من الحواف لإزالة هالة الرمادي
"""

import os
import sys
import argparse

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# 1) نموذج الخلفية: نقدّر لون الخلفية في كل نقطة من الصورة
#    بالاعتماد على لون الزوايا الأربع (الخلفية قد تكون متدرجة قليلًا).
# ---------------------------------------------------------------------------
def corner_color(lab, y, x, size=24):
    """متوسط لون مربع صغير في زاوية الصورة (بفضاء Lab)."""
    patch = lab[y:y + size, x:x + size].reshape(-1, 3)
    return np.median(patch, axis=0)


def background_model(lab):
    """يبني صورة تمثل لون الخلفية المتوقع في كل بكسل (تدرّج بين الزوايا)."""
    h, w = lab.shape[:2]
    m = 6  # هامش صغير عن الحافة
    tl = corner_color(lab, m, m)
    tr = corner_color(lab, m, w - 24 - m)
    bl = corner_color(lab, h - 24 - m, m)
    br = corner_color(lab, h - 24 - m, w - 24 - m)

    ys = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    xs = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
    top = tl[None, None, :] * (1 - xs) + tr[None, None, :] * xs
    bottom = bl[None, None, :] * (1 - xs) + br[None, None, :] * xs
    return top * (1 - ys) + bottom * ys


# ---------------------------------------------------------------------------
# 2) القص
# ---------------------------------------------------------------------------
def make_mask(bgr, tol=14):
    """يرجع (القناع، خريطة المسافة عن الخلفية). القناع: 255 = المنتج، 0 = الخلفية."""
    h, w = bgr.shape[:2]

    # نحوّل إلى Lab: فضاء ألوان أقرب لما تراه العين من RGB
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    bg = background_model(lab)

    # المسافة عن الخلفية (قناتا اللون a وb لهما وزن مضاعف)
    diff = lab - bg
    dist = np.sqrt(diff[..., 0] ** 2 + (2 * diff[..., 1]) ** 2 + (2 * diff[..., 2]) ** 2)
    dist = cv2.GaussianBlur(dist, (0, 0), 1.0)
    mask = (dist > tol).astype(np.uint8) * 255

    # الخطاف المعدني الرفيع قريب جدًا من لون الخلفية، فنلتقطه
    # بواسطة "قوة الحواف" (المنتج فيه خطوط وحواف، والخلفية ناعمة تمامًا)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    edge = cv2.GaussianBlur(np.sqrt(gx ** 2 + gy ** 2), (0, 0), 0.8)
    edge_mask = (edge > 18).astype(np.uint8) * 255
    mask = cv2.bitwise_or(mask, edge_mask)
    edge_raw = edge

    # نغلق الفجوات الصغيرة (كالخيوط والطيّات)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)

    # نحتفظ بالقطعة الكبيرة وما يتصل بها (الشماعة والخطاف)، ونحذف البقع المنفصلة
    mask = keep_main_object(mask)

    # نملأ الثقوب الصغيرة داخل المنتج (بقع صغيرة فقط)
    mask = fill_small_holes(mask, max_area=400)

    # نقشّر أي حافة لونها يشبه الخلفية الرمادية (الهالة) من الخارج للداخل،
    # ونتوقف عند المادة الحقيقية. الخطاف المعدني محمي بقوة حوافه.
    mask = peel_background_fringe(mask, dist, edge_raw, tol)
    return mask


def keep_main_object(mask):
    """يبقي أكبر شكل وما يلامسه، ويحذف أي بقع منفصلة صغيرة."""
    # نوسّع القناع قليلًا حتى تلتحم الأجزاء القريبة (مثل الخطاف مع الشماعة)
    grown = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(grown, connectivity=8)
    if n <= 1:
        return mask
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    region = (labels == largest).astype(np.uint8) * 255
    return cv2.bitwise_and(mask, region)


def fill_small_holes(mask, max_area=400):
    """يملأ الثقوب الصغيرة، ويترك الفجوات الكبيرة الحقيقية شفافة."""
    inv = cv2.bitwise_not(mask)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    out = mask.copy()
    h, w = mask.shape
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        touches_border = x == 0 or y == 0 or x + bw >= w or y + bh >= h
        if not touches_border and area <= max_area:
            out[labels == i] = 255
    return out


def peel_background_fringe(mask, dist, edge, tol, max_px=14):
    """
    يزيل بكسلات الحافة التي لونها قريب من الخلفية، بشرط ألا تكون حافة حقيقية.
    يكرر العملية حتى 14 بكسل، ثم يتوقف عند أول مادة حقيقية.
    """
    k = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    looks_like_bg = (dist < tol * 1.25) & (edge < 30)
    cur = mask.copy()
    for _ in range(max_px):
        inner = cv2.erode(cur, k)
        ring = (cur > 0) & (inner == 0)             # بكسلات الحافة الحالية
        remove = ring & looks_like_bg
        if not remove.any():
            break
        cur[remove] = 0
    return cur


def peel_edges(mask, pixels=2):
    """يقشّر حافة المنتج بضعة بكسلات لإزالة هالة الخلفية الرمادية."""
    if pixels <= 0:
        return mask
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    return cv2.erode(mask, k, iterations=pixels)


def soft_alpha(mask):
    """يجعل الحافة ناعمة (بدون تسنن) بتمويه خفيف جدًا."""
    a = cv2.GaussianBlur(mask, (0, 0), 0.9)
    return a


# ---------------------------------------------------------------------------
# 3) معالجة صورة واحدة
# ---------------------------------------------------------------------------
def process(path_in, path_out, tol, peel):
    bgr = cv2.imread(path_in, cv2.IMREAD_COLOR)
    if bgr is None:
        print(f"  [skip] cannot read image: {path_in}")
        return False

    mask = make_mask(bgr, tol=tol)
    mask = peel_edges(mask, pixels=peel)
    alpha = soft_alpha(mask)

    # نركّب القناة الشفافة على الصورة
    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[..., 3] = alpha
    cv2.imwrite(path_out, bgra)

    # نسخة الفحص على خلفية ماجنتا
    magenta = np.full_like(bgr, (255, 0, 255))  # BGR
    a = (alpha.astype(np.float32) / 255.0)[..., None]
    check = (bgr.astype(np.float32) * a + magenta.astype(np.float32) * (1 - a)).astype(np.uint8)
    check_path = os.path.splitext(path_out)[0] + "_check.png"
    cv2.imwrite(check_path, check)

    cover = 100.0 * (mask > 0).sum() / mask.size
    print(f"  done: {os.path.basename(path_out)}  (product covers {cover:.0f}% of the image)")
    return True


def main():
    p = argparse.ArgumentParser(description="قص المنتجات من الخلفية الرمادية")
    p.add_argument("input", help="صورة أو مجلد صور")
    p.add_argument("output", help="مجلد الإخراج")
    p.add_argument("--tol", type=float, default=14, help="حساسية الفصل (افتراضي 14)")
    p.add_argument("--peel", type=int, default=2, help="بكسلات قشر الحواف (افتراضي 2)")
    args = p.parse_args()

    os.makedirs(args.output, exist_ok=True)

    exts = (".png", ".jpg", ".jpeg", ".webp", ".jfif")
    if os.path.isdir(args.input):
        files = sorted(f for f in os.listdir(args.input) if f.lower().endswith(exts))
        paths = [os.path.join(args.input, f) for f in files]
    else:
        paths = [args.input]

    if not paths:
        print("No images found in:", args.input)
        sys.exit(1)

    print(f"Cutting out {len(paths)} image(s)...")
    for path in paths:
        name = os.path.splitext(os.path.basename(path))[0]
        out = os.path.join(args.output, name + ".png")
        process(path, out, args.tol, args.peel)
    print("Finished. Open the files ending in _check and inspect them on the magenta background.")


if __name__ == "__main__":
    main()
