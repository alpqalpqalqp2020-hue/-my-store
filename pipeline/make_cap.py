"""
make_cap.py  -  تجهيز قبعة جديدة بأمر واحد
==========================================

يقصّ خلفية صور القبعة، ويجهّزها للويب، ويصنع صورة معاينة،
ويطبع السطور الجاهزة لإضافتها إلى ملف المنتجات.

تسمية الصور المولَّدة (في generated\\caps):
  cap1a.png = الأمام      cap1b.png = الخلف      cap1c.png = الجانب
  (الرقم 1 هو رقم القبعة. وتصلح الصيغ png / jpg / jpeg / webp)

طريقة الاستخدام (من مجلد my-store):
  python pipeline\\make_cap.py cap-navy 1 --width 0.20

  - cap-navy : معرّف المنتج (حروف إنجليزية وأرقام وشرطات)
  - 1        : رقم القبعة في أسماء الصور
  - --width  : عرض القبعة الحقيقي من الأمام بالمتر
               (قبعة عادية 0.20، قبعة باكيت 0.30 إلى 0.34)
  - --side-faces right : إن كانت حافة القبعة (الفيزور) في الصورة الجانبية تتجه لليمين
"""

import os
import sys
import glob
import argparse
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import cutout_grey  # noqa: E402
from PIL import Image  # noqa: E402

EXTS = ("png", "jpg", "jpeg", "webp")


def find_image(folder, stem):
    for ext in EXTS:
        for path in glob.glob(os.path.join(folder, f"{stem}.{ext}")):
            return path
    return None


def main():
    p = argparse.ArgumentParser(description="تجهيز قبعة جديدة بأمر واحد")
    p.add_argument("product_id")
    p.add_argument("number")
    p.add_argument("--width", type=float, default=0.20)
    p.add_argument("--side-faces", choices=["left", "right"], default="left")
    p.add_argument("--src", default="generated/caps")
    args = p.parse_args()

    pid = args.product_id.strip().lower()
    if not all(c.isalnum() or c == "-" for c in pid):
        raise SystemExit("معرّف المنتج يجب أن يكون حروفًا إنجليزية وأرقامًا وشرطات فقط، مثل cap-navy")

    sources = {}
    for view, letter in {"front": "a", "back": "b", "side": "c"}.items():
        stem = f"cap{args.number}{letter}"
        path = find_image(args.src, stem)
        if not path:
            raise SystemExit(f"لم أجد الصورة {stem} في المجلد {args.src}. تأكد من الاسم (مثل {stem}.png).")
        sources[view] = path
    print("الصور التي وجدتها:")
    for view, path in sources.items():
        print(f"  {view:5s} <- {path}")

    cut_dir = os.path.join("pipeline", "cutouts", pid)
    os.makedirs(cut_dir, exist_ok=True)
    print("\n[1/2] قص الخلفية...")
    for view, path in sources.items():
        cutout_grey.process(path, os.path.join(cut_dir, f"{view}.png"), tol=14, peel=2)

    print("\n[2/2] التجهيز للويب...")
    cmd = [sys.executable, os.path.join(HERE, "prepare_caps.py"), pid,
           "--width", str(args.width), "--side-faces", args.side_faces]
    if subprocess.run(cmd).returncode != 0:
        raise SystemExit("فشل التجهيز. انسخ الرسالة التي ظهرت وأرسلها لي.")

    web_dir = os.path.join("store", "public", "garments", pid)
    imgs = [Image.open(os.path.join(web_dir, f"{v}.webp")).convert("RGBA") for v in ("front", "back", "side")]
    h = max(i.height for i in imgs)
    w = sum(i.width for i in imgs) + 40 * 4
    sheet = Image.new("RGBA", (w, h + 80), (255, 0, 255, 255))
    x = 40
    for im in imgs:
        sheet.alpha_composite(im, (x, 40))
        x += im.width + 40
    preview = os.path.join(cut_dir, "preview.jpg")
    sheet.convert("RGB").save(preview, quality=88)

    print("\n" + "=" * 60)
    print("تم تجهيز القبعة:", pid)
    print("=" * 60)
    print(f"1) افتح صورة المعاينة وافحصها:\n   {preview}")
    print("   - الصور الثلاث على خلفية ماجنتا بحواف نظيفة (بلا هالة رمادية)")
    print("   - لا يوجد رأس أو يد أو حامل أو ظل، والقبعة كاملة")
    print("   - في الجانبية: حافة القبعة (الفيزور) تتجه إلى اليمين")
    print("   (إن كانت بالعكس فأعد الأمر مع  --side-faces right)")
    print("\n2) أضف هذا إلى ملف  store\\src\\data\\products.js  داخل القائمة:\n")
    print("  {")
    print(f'    id: "{pid}",')
    print('    category: "caps",')
    print('    name: "اكتب الاسم هنا",')
    print("    price: 15000,")
    print('    colorway: "اكتب اللون هنا",')
    print('    sizes: { "حر": true },')
    print("  },")
    print("\n3) ارفع التعديلات:  git add .   ثم   git commit   ثم   git push")


if __name__ == "__main__":
    main()
