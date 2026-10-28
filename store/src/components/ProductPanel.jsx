import { useEffect, useState } from "react";
import { formatPrice } from "../lib/format";
import { CATEGORY_LABELS } from "../data/labels";

// أزرار الصور المصغّرة: كل زر يدير القطعة إلى جانب
const VIEWS = [
  { key: "front", label: "الأمام" },
  { key: "side", label: "الجانب" },
  { key: "back", label: "الخلف" },
];

// لوحة المنتج: صور مصغّرة + بطاقة فيها الاسم والسعر والمقاس وزر الإضافة
export default function ProductPanel({ product, view, onView, size, onSize, onAdd, inCart }) {
  const [needSize, setNeedSize] = useState(false); // يظهر التنبيه الأحمر
  const [shake, setShake] = useState(0); // رقم يتغير لإعادة تشغيل حركة الاهتزاز

  // عند تغيير المنتج نمسح التنبيه
  useEffect(() => setNeedSize(false), [product.id]);

  const handleAdd = () => {
    if (!size) {
      setNeedSize(true);
      setShake((n) => n + 1);
      return;
    }
    onAdd();
  };

  const pickSize = (s) => {
    onSize(s);
    setNeedSize(false);
  };

  return (
    <div className="panel">
      <div className="thumbs" role="tablist" aria-label="زوايا العرض">
        {VIEWS.map((v, i) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === i}
            aria-label={v.label}
            className={`thumb ${view === i ? "active" : ""}`}
            onClick={() => onView(i)}
          >
            <img src={`/garments/${product.id}/${v.key}.webp?v=1`} alt="" draggable="false" />
          </button>
        ))}
      </div>

      <section className="card" dir="rtl">
        <div className="card-cat">{CATEGORY_LABELS[product.category] ?? product.category}</div>
        <h2 className="card-name">{product.name}</h2>
        <div className="card-price">{formatPrice(product.price)}</div>
        <div className="card-color">{product.colorway}</div>

        <div className="card-sep" />

        <div className="size-head">
          <span className={needSize ? "need" : ""} key={shake}>
            {needSize ? "اختر المقاس أولًا" : "اختر المقاس"}
          </span>
        </div>
        <div className="sizes">
          {Object.entries(product.sizes).map(([s, available]) => (
            <button
              key={s}
              className={`size ${size === s ? "active" : ""}`}
              disabled={!available}
              aria-pressed={size === s}
              onClick={() => pickSize(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <button key={`add-${shake}`} className={`add-btn ${needSize ? "shake" : ""}`} onClick={handleAdd}>
          {inCart ? "تمت الإضافة ✓" : "أضف إلى السلة"}
        </button>
      </section>
    </div>
  );
}
