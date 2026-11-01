"""
make_product.py  -  تجهيز منتج جديد بأمر واحد
=============================================

ماذا يفعل؟
  يأخذ صور المنتج المولَّدة (أمام / خلف / جانب) من مجلد generated\\clothes
  ويقوم بالخطوتين معًا:
    1) قص الخلفية الرمادية (cutout_grey.py)
    2) التجهيز للويب (prepare_views.py): WebP + المقاسات الحقيقية
  ثم يصنع صورة معاينة واحدة تراها بعينك، ويطبع لك السطور
  الجاهزة لإضافتها إلى ملف المنتجات.

تسمية الصور المولَّدة (في generated\\clothes):
  img2a.png  = الأمام
  img2b.png  = الخلف
  img2c.png  = الجانب
  (الرقم 2 هو رقم المنتج. وتصلح الصيغ png / jpg / jpeg / webp)

طريقة الاستخدام (من مجلد my-store):
  python pipeline\\make_product.py hoodie-black 2

  - الأول: معرّف المنتج بالإنجليزية بلا مسافات (يصبح اسم المجلد)
  - الثاني: رقم المنتج في أسماء الصور

خيار اختياري:
  --side-faces right   إذا كان أمام القطعة في الصورة الجانبية ينظر لليمين
                       (الافتراضي left، وهو ما حدث مع الهودي)
"""

import os
import sys
import glob
import argparse
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import cutout_grey  # noqa: E402  (السكربت الذي أنشأناه سابقًا)
from PIL import Image  # noqa: E402

EXTS = ("png", "jpg", "jpeg", "webp")


def find_image(folder, stem):
    """يبحث عن الصورة بأي صيغة مدعومة (img2a.png أو img2a.jpg ...)."""
    for ext in EXTS:
        for path in glob.glob(os.path.join(folder, f"{stem}.{ext}")):
            return path
    return None


def main():
    p = argparse.ArgumentParser(description="تجهيز منتج جديد بأمر واحد")
    p.add_argument("product_id", help="معرّف المنتج بالإنجليزية، مثل hoodie-black")
    p.add_argument("number", help="رقم المنتج في أسماء الصور، مثل 2")
    p.add_argument("--side-faces", choices=["left", "right"], default="left")
    p.add_argument("--src", default="generated/clothes", help="مجلد الصور المولَّدة")
    args = p.parse_args()

    pid = args.product_id.strip().lower()
    if not all(c.isalnum() or c == "-" for c in pid):
        raise SystemExit("معرّف المنتج يجب أن يكون حروفًا إنجليزية وأرقامًا وشرطات فقط، مثل hoodie-black")

    # 1) نجد الصور الثلاث
    views = {"front": "a", "back": "b", "side": "c"}
    sources = {}
    for view, letter in views.items():
        stem = f"img{args.number}{letter}"
        path = find_image(args.src, stem)
        if not path:
            raise SystemExit(f"لم أجد الصورة {stem} في المجلد {args.src}. تأكد من الاسم (مثل {stem}.png).")
        sources[view] = path
    print("الصور التي وجدتها:")
    for view, path in sources.items():
        print(f"  {view:5s} <- {path}")

    # 2) القص
    cut_dir = os.path.join("pipeline", "cutouts", pid)
    os.makedirs(cut_dir, exist_ok=True)
    print("\n[1/2] قص الخلفية...")
    for view, path in sources.items():
        cutout_grey.process(path, os.path.join(cut_dir, f"{view}.png"), tol=14, peel=2)

    # 3) التجهيز للويب
    print("\n[2/2] التجهيز للويب...")
    cmd = [
        sys.executable,
        os.path.join(HERE, "prepare_views.py"),
        pid,
        "--front", "front",
        "--back", "back",
        "--side", "side",
        "--side-faces", args.side_faces,
    ]
    result = subprocess.run(cmd)
    if result.returncode != 0:
        raise SystemExit("فشل التجهيز. انسخ الرسالة التي ظهرت وأرسلها لي.")

    # 4) صورة معاينة واحدة على خلفية ماجنتا
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
    print("تم تجهيز المنتج:", pid)
    print("=" * 60)
    print(f"1) افتح صورة المعاينة وافحصها:\n   {preview}")
    print("   - الشماعة الخشبية ظاهرة بلا خطاف فضي فوقها")
    print("   - الجانبية: أمام القطعة ينظر إلى اليمين (والغطاء على اليسار)")
    print("   - لا بقع رمادية على الحواف")
    print("   (إن كانت الجانبية بالعكس فأعد الأمر مع  --side-faces right)")
    print("\n2) أضف هذا إلى ملف  store\\src\\data\\products.js  داخل القائمة:\n")
    print("  {")
    print(f'    id: "{pid}",')
    print('    category: "clothing",')
    print('    name: "اكتب الاسم هنا",')
    print("    price: 35000,")
    print('    colorway: "اكتب اللون هنا",')
    print("    sizes: { S: true, M: true, L: true, XL: true },")
    print("  },")
    print("\n3) ارفع التعديلات:  git add .   ثم   git commit   ثم   git push")


if __name__ == "__main__":
    main()
